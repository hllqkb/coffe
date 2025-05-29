// pages/knowledge/knowledge.js
Page({
  data: {
    // 搜索相关
    searchKeyword: '',
    
    // 分类数据
    categories: [
      { id: 'all', name: '全部', icon: '/images/icons/all.png' },
      { id: 'planting', name: '种植', icon: '/images/icons/plant.png' },
      { id: 'processing', name: '加工', icon: '/images/icons/process.png' },
      { id: 'brewing', name: '冲泡', icon: '/images/icons/brew.png' },
      { id: 'tasting', name: '品鉴', icon: '/images/icons/taste.png' },
      { id: 'culture', name: '文化', icon: '/images/icons/culture.png' },
      { id: 'health', name: '健康', icon: '/images/icons/health.png' }
    ],
    activeCategory: 'all',
    
    // 推荐内容
    featuredContent: [
      {
        id: 'f1',
        title: '咖啡豆的成熟过程',
        description: '从开花到成熟，了解咖啡豆的完整生长周期',
        image: '/images/featured/coffee-growth.jpg',
        type: 'video'
      },
      {
        id: 'f2',
        title: '手冲咖啡的艺术',
        description: '掌握手冲技巧，品味咖啡的真正魅力',
        image: '/images/featured/hand-brew.jpg',
        type: 'video'
      },
      {
        id: 'f3',
        title: '世界咖啡产区介绍',
        description: '探索不同产区的咖啡风味特色',
        image: '/images/featured/coffee-regions.jpg',
        type: 'article'
      }
    ],
    
    // 内容列表
    contentList: [],
    
    // 分页相关
    currentPage: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    
    // 模态框状态
    showContentModal: false,
    showCommentModal: false,
    currentContent: null,
    
    // 评论相关
    comments: [],
    commentInput: '',
    
    // 视频播放
    videoContext: null
  },

  onLoad() {
    this.loadContent();
  },

  onShow() {
    // 页面显示时刷新数据
    if (this.data.contentList.length === 0) {
      this.loadContent();
    }
  },

  // 搜索功能
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  onSearchConfirm() {
    this.resetAndLoadContent();
  },

  onSearchClear() {
    this.setData({
      searchKeyword: ''
    });
    this.resetAndLoadContent();
  },

  // 分类切换
  onCategoryChange(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({
      activeCategory: categoryId
    });
    this.resetAndLoadContent();
  },

  // 重置并加载内容
  resetAndLoadContent() {
    this.setData({
      contentList: [],
      currentPage: 1,
      hasMore: true
    });
    this.loadContent();
  },

  // 加载内容
  async loadContent() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'knowledgeManager',
        data: {
          action: 'getContent',
          page: this.data.currentPage,
          limit: this.data.pageSize,
          category: this.data.activeCategory,
          keyword: this.data.searchKeyword
        }
      });
      
      if (result.result.success) {
        const newContent = result.result.data;
        
        this.setData({
          contentList: [...this.data.contentList, ...newContent],
          currentPage: this.data.currentPage + 1,
          hasMore: newContent.length >= this.data.pageSize
        });
      } else {
        wx.showToast({
          title: result.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载内容失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadContent();
    }
  },

  // 加载更多 (兼容旧的 onLoadMore 调用)
  onLoadMore() {
    this.loadMore();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.resetAndLoadContent();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 触底加载
  onReachBottom() {
    this.loadContent();
  },

  // 点击内容项
  onContentTap(e) {
    const { id } = e.currentTarget.dataset;
    const content = this.data.contentList.find(item => item._id === id) || 
                   this.data.featuredContent.find(item => item.id === id);
    
    if (content) {
      this.showContentDetail(content);
      this.recordView(id);
    }
  },

  // 显示内容详情
  async showContentDetail(content) {
    // 如果是简化数据，需要获取完整内容
    let fullContent = content;
    if (!content.content && content._id) {
      try {
        const db = wx.cloud.database();
        const { data } = await db.collection('knowledge_content')
          .doc(content._id)
          .get();
        fullContent = data;
      } catch (error) {
        console.error('获取内容详情失败:', error);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        return;
      }
    }

    this.setData({
      currentContent: fullContent,
      showContentModal: true
    });

    // 如果是视频，创建视频上下文
    if (fullContent.type === 'video') {
      this.data.videoContext = wx.createVideoContext('contentVideo');
    }
  },

  // 关闭内容详情
  closeContentModal() {
    this.setData({
      showContentModal: false,
      currentContent: null
    });
    
    // 停止视频播放
    if (this.data.videoContext) {
      this.data.videoContext.stop();
      this.data.videoContext = null;
    }
  },

  // 记录浏览
  async recordView(contentId) {
    try {
      await wx.cloud.callFunction({
        name: 'updateContentStats',
        data: {
          contentId,
          action: 'view'
        }
      });
    } catch (error) {
      console.error('记录浏览失败:', error);
    }
  },

  // 点赞
  async onLike() {
    if (!this.data.currentContent) return;

    try {
      const { _id } = this.data.currentContent;
      const result = await wx.cloud.callFunction({
        name: 'updateContentStats',
        data: {
          contentId: _id,
          action: 'like'
        }
      });

      if (result.result.success) {
        const updatedContent = {
          ...this.data.currentContent,
          isLiked: result.result.isLiked,
          likeCount: this.formatNumber(result.result.likeCount)
        };
        
        this.setData({
          currentContent: updatedContent
        });

        // 更新列表中的数据
        this.updateContentInList(_id, {
          isLiked: result.result.isLiked,
          likeCount: this.formatNumber(result.result.likeCount)
        });

        wx.showToast({
          title: result.result.isLiked ? '已点赞' : '已取消',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('点赞失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 收藏
  async onFavorite() {
    if (!this.data.currentContent) return;

    try {
      const { _id } = this.data.currentContent;
      const result = await wx.cloud.callFunction({
        name: 'updateContentStats',
        data: {
          contentId: _id,
          action: 'favorite'
        }
      });

      if (result.result.success) {
        const updatedContent = {
          ...this.data.currentContent,
          isFavorited: result.result.isFavorited
        };
        
        this.setData({
          currentContent: updatedContent
        });

        // 更新列表中的数据
        this.updateContentInList(_id, {
          isFavorited: result.result.isFavorited
        });

        wx.showToast({
          title: result.result.isFavorited ? '已收藏' : '已取消',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('收藏失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 分享
  onShare() {
    if (!this.data.currentContent) return;

    const { title, _id } = this.data.currentContent;
    return {
      title: `推荐一篇咖啡知识：${title}`,
      path: `/pages/knowledge/knowledge?contentId=${_id}`,
      imageUrl: this.data.currentContent.cover || '/images/share-default.jpg'
    };
  },

  // 显示评论
  async showComments() {
    if (!this.data.currentContent) return;

    this.setData({
      showCommentModal: true
    });

    await this.loadComments();
  },

  // 加载评论
  async loadComments() {
    if (!this.data.currentContent) return;

    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('content_comments')
        .where({
          contentId: this.data.currentContent._id
        })
        .orderBy('createTime', 'desc')
        .limit(50)
        .get();

      const processedComments = data.map(comment => ({
        ...comment,
        createTime: this.formatTime(comment.createTime)
      }));

      this.setData({
        comments: processedComments
      });
    } catch (error) {
      console.error('加载评论失败:', error);
    }
  },

  // 关闭评论
  closeCommentModal() {
    this.setData({
      showCommentModal: false,
      comments: [],
      commentInput: ''
    });
  },

  // 评论输入
  onCommentInput(e) {
    this.setData({
      commentInput: e.detail.value
    });
  },

  // 发送评论
  async sendComment() {
    const { commentInput, currentContent } = this.data;
    
    if (!commentInput.trim()) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none'
      });
      return;
    }

    if (!currentContent) return;

    try {
      const result = await wx.cloud.callFunction({
        name: 'addComment',
        data: {
          contentId: currentContent._id,
          content: commentInput.trim()
        }
      });

      if (result.result.success) {
        this.setData({
          commentInput: ''
        });
        
        // 重新加载评论
        await this.loadComments();
        
        // 更新评论数
        const updatedContent = {
          ...this.data.currentContent,
          commentCount: this.formatNumber((parseInt(this.data.currentContent.commentCount) || 0) + 1)
        };
        
        this.setData({
          currentContent: updatedContent
        });

        // 更新列表中的数据
        this.updateContentInList(currentContent._id, {
          commentCount: updatedContent.commentCount
        });

        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('发送评论失败:', error);
      wx.showToast({
        title: '评论失败',
        icon: 'none'
      });
    }
  },

  // 更新列表中的内容数据
  updateContentInList(contentId, updates) {
    const contentList = this.data.contentList.map(item => {
      if (item._id === contentId) {
        return { ...item, ...updates };
      }
      return item;
    });
    
    this.setData({ contentList });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) { // 1天内
      return `${Math.floor(diff / 3600000)}小时前`;
    } else if (diff < 2592000000) { // 30天内
      return `${Math.floor(diff / 86400000)}天前`;
    } else {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }
  },

  // 格式化数字
  formatNumber(num) {
    if (num < 1000) {
      return num.toString();
    } else if (num < 10000) {
      return (num / 1000).toFixed(1) + 'k';
    } else {
      return (num / 10000).toFixed(1) + 'w';
    }
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '咖啡知识大全 - 学习咖啡文化',
      path: '/pages/knowledge/knowledge',
      imageUrl: '/images/share-knowledge.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '咖啡知识大全 - 学习咖啡文化',
      imageUrl: '/images/share-knowledge.jpg'
    };
  }
});