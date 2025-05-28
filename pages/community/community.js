// pages/community/community.js
Page({
  data: {
    // 帖子列表
    posts: [],
    // 分页相关
    currentPage: 1,
    hasMore: true,
    loading: false,
    // 发布相关
    showPublishModal: false,
    publishContent: '',
    publishImages: [],
    publishVideo: '',
    publishing: false,
    // 用户信息
    userInfo: null,
    // 搜索相关
    searchKeyword: '',
    showSearch: false
  },

  onLoad() {
    this.loadUserInfo();
    this.loadPosts();
  },

  onShow() {
    // 刷新帖子列表
    this.refreshPosts();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({ userInfo });
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  },

  // 加载帖子列表
  async loadPosts(refresh = false) {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'getPosts',
          page: refresh ? 1 : this.data.currentPage,
          limit: 10,
          keyword: this.data.searchKeyword
        }
      });
      
      if (result.result.success) {
        const posts = result.result.data;
        
        if (refresh) {
          this.setData({
            posts: posts,
            currentPage: 1,
            hasMore: posts.length >= 10
          });
        } else {
          this.setData({
            posts: [...this.data.posts, ...posts],
            currentPage: this.data.currentPage + 1,
            hasMore: posts.length >= 10
          });
        }
      } else {
        wx.showToast({
          title: result.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载帖子失败:', error);
      // 如果云函数调用失败，使用模拟数据
      const page = refresh ? 1 : this.data.currentPage;
      const mockPosts = this.generateMockPosts(page);
      const posts = refresh ? mockPosts : [...this.data.posts, ...mockPosts];
      
      this.setData({
        posts,
        currentPage: page + 1,
        hasMore: mockPosts.length === 10
      });
    }
    
    this.setData({ loading: false });
  },

  // 生成模拟数据
  generateMockPosts(page) {
    const posts = [];
    const users = [
      { nickname: '咖啡爱好者', avatar: '/images/default-avatar.png' },
      { nickname: '小树种植家', avatar: '/images/default-avatar.png' },
      { nickname: '豆子收藏家', avatar: '/images/default-avatar.png' }
    ];
    
    for (let i = 0; i < 10; i++) {
      const user = users[i % users.length];
      const postId = (page - 1) * 10 + i + 1;
      
      const imageOptions = [
        [],
        ['/images/arabica.png'],
        ['/images/robusta.png'],
        ['/images/stage-mature.png'],
        ['/images/stage-fruit.png'],
        ['/images/stage-seedling.png'],
        ['/images/stage-sprout.png'],
        ['/images/arabica.png', '/images/robusta.png'],
        ['/images/stage-mature.png', '/images/stage-fruit.png']
      ];
      
      posts.push({
        id: postId,
        user: user,
        content: `这是第${postId}条帖子的内容，分享我的咖啡种植心得和经验。今天的咖啡树长得特别好，叶子绿油油的，看起来很健康！`,
        images: imageOptions[i % imageOptions.length],
        video: i % 8 === 0 ? 'https://example.com/sample-video.mp4' : '',
        createTime: new Date(Date.now() - i * 3600000).toISOString(),
        likeCount: Math.floor(Math.random() * 100),
        commentCount: Math.floor(Math.random() * 50),
        shareCount: Math.floor(Math.random() * 20),
        liked: false
      });
    }
    
    return posts;
  },

  // 刷新帖子
  refreshPosts() {
    this.setData({ currentPage: 1 });
    this.loadPosts(true);
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.refreshPosts();
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadPosts();
    }
  },

  // 显示发布模态框
  showPublishModal() {
    this.setData({ showPublishModal: true });
  },

  // 隐藏发布模态框
  hidePublishModal() {
    this.setData({
      showPublishModal: false,
      publishContent: '',
      publishImages: [],
      publishVideo: ''
    });
  },
  
  // 阻止事件冒泡
  stopPropagation() {
    // 仅用于阻止事件冒泡
    return;
  },

  // 输入发布内容
  onPublishInput(e) {
    this.setData({
      publishContent: e.detail.value
    });
  },

  // 选择图片
  async chooseImages() {
    try {
      const res = await wx.chooseMedia({
        count: 9 - this.data.publishImages.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      });
      
      const newImages = res.tempFiles.map(file => file.tempFilePath);
      const publishImages = [...this.data.publishImages, ...newImages];
      
      this.setData({ publishImages });
    } catch (error) {
      console.error('选择图片失败:', error);
    }
  },

  // 选择视频
  async chooseVideo() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera']
      });
      
      this.setData({
        publishVideo: res.tempFiles[0].tempFilePath,
        publishImages: [] // 选择视频后清空图片
      });
    } catch (error) {
      console.error('选择视频失败:', error);
    }
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const publishImages = this.data.publishImages.filter((_, i) => i !== index);
    this.setData({ publishImages });
  },

  // 删除视频
  deleteVideo() {
    this.setData({ publishVideo: '' });
  },

  // 发布帖子
  async publishPost() {
    const { publishContent, publishImages, publishVideo, userInfo } = this.data;
    
    if (!publishContent || publishContent.length === 0) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ publishing: true });
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'createPost',
          content: publishContent,
          images: publishImages,
          video: publishVideo,
          userInfo: userInfo || {
            nickName: '匿名用户',
            avatarUrl: '/images/default-avatar.png'
          }
        }
      });
      
      if (result.result.success) {
        // 先关闭弹窗，再显示成功提示
        this.setData({
          showPublishModal: false,
          publishContent: '',
          publishImages: [],
          publishVideo: ''
        });
        
        wx.showToast({
          title: '发布成功',
          icon: 'success'
        });
        
        this.refreshPosts();
      } else {
        wx.showToast({
          title: result.result.message || '发布失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('发布失败:', error);
      wx.showToast({
        title: '发布失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ publishing: false });
    }
  },

  // 切换点赞状态
  async togglePostLike(e) {
    // 安全地阻止事件冒泡
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const postId = e.currentTarget.dataset.id;
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'likePost',
          postId: postId
        }
      });
      
      if (result.result.success) {
        const { isLiked, likeCount } = result.result.data;
        const posts = this.data.posts.map(post => {
          if (post.id === postId || post._id === postId) {
            return {
              ...post,
              liked: isLiked,
              likeCount: likeCount
            };
          }
          return post;
        });
        
        this.setData({ posts });
        
        // 触觉反馈
        wx.vibrateShort();
      }
    } catch (error) {
      console.error('点赞失败:', error);
      // 如果云函数调用失败，使用本地逻辑
      const posts = this.data.posts.map(post => {
        if (post.id === postId || post._id === postId) {
          return {
            ...post,
            liked: !post.liked,
            likeCount: post.liked ? post.likeCount - 1 : post.likeCount + 1
          };
        }
        return post;
      });
      
      this.setData({ posts });
      wx.vibrateShort();
    }
  },

  // 打开帖子详情
  openPostDetail(e) {
    const postId = e.currentTarget.dataset.id;
    const post = this.data.posts.find(p => p.id === postId);
    if (post) {
      wx.navigateTo({
        url: `/pages/comments/comments?postId=${postId}&title=${encodeURIComponent(post.content.substring(0, 20) + '...')}`
      });
    }
  },

  // 查看评论
  viewComments(e) {
    // 安全地阻止事件冒泡
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const postId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/comments/comments?postId=${postId}`
    });
  },

  // 分享帖子
  sharePost(e) {
    // 安全地阻止事件冒泡
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const postId = e.currentTarget.dataset.id;
    // 更新分享数
    const posts = this.data.posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          shareCount: post.shareCount + 1
        };
      }
      return post;
    });
    
    this.setData({ posts });
  },

  // 预览图片
  previewImage(e) {
    // 安全地阻止事件冒泡
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const { current, urls } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls
    });
  },

  // 搜索相关
  showSearch() {
    this.setData({ showSearch: true });
  },

  hideSearch() {
    this.setData({ showSearch: false, searchKeyword: '' });
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  searchPosts() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) return;
    
    // 这里应该调用搜索接口
    wx.showToast({
      title: `搜索: ${keyword}`,
      icon: 'none'
    });
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '咖啡社区 - 分享种植心得',
      path: '/pages/community/community'
    };
  },

  onShareTimeline() {
    return {
      title: '咖啡社区 - 分享种植心得'
    };
  }
});