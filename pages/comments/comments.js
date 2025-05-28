// pages/comments/comments.js
Page({
  data: {
    postId: '',
    postInfo: null,
    comments: [],
    commentContent: '',
    replyToComment: null,
    loading: false,
    hasMore: true,
    currentPage: 1,
    userInfo: null
  },

  onLoad(options) {
    const { postId } = options;
    if (postId) {
      this.setData({ postId });
      this.loadUserInfo();
      this.loadPostInfo();
      this.loadComments();
    }
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

  // 加载帖子信息
  async loadPostInfo() {
    try {
      // 加载帖子信息
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'getPostDetail',
          postId: this.data.postId
        }
      })
      
      if (result.result.success) {
        const postInfo = result.result.data
        this.setData({ 
          postInfo: {
            ...postInfo,
            user: {
              nickname: postInfo.author.nickname,
              avatar: postInfo.author.avatar
            }
          }
        })
        return
      }
      
      // 如果云函数调用失败，尝试从上一页面获取
      const pages = getCurrentPages()
      const prevPage = pages[pages.length - 2]
      
      if (prevPage && prevPage.data.posts) {
        const post = prevPage.data.posts.find(p => p.id === this.data.postId || p._id === this.data.postId)
        if (post) {
          this.setData({ 
            postInfo: {
              ...post,
              user: {
                nickname: post.author ? post.author.nickname : post.user.nickname,
                avatar: post.author ? post.author.avatar : post.user.avatar
              }
            }
          })
          return
        }
      }
      
      // 如果都失败了，显示错误信息
      wx.showToast({
        title: '获取帖子信息失败',
        icon: 'none'
      })
      
    } catch (error) {
      console.error('加载帖子信息失败:', error)
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }
  },

  // 加载评论列表（优化版）
  async loadComments(refresh = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'getComments',
          postId: this.data.postId,
          page: refresh ? 1 : this.data.currentPage,
          limit: 20
        }
      })
      
      if (result.result.success) {
        const comments = result.result.data
        
        // 检查用户是否已点赞每条评论
        const userInfo = wx.getStorageSync('userInfo')
        const openid = userInfo ? userInfo.openid : ''
        
        const processedComments = comments.map(comment => ({
          ...comment,
          liked: comment.likes && comment.likes.includes(openid)
        }))
        
        this.setData({
          comments: refresh ? processedComments : [...this.data.comments, ...processedComments],
          currentPage: refresh ? 2 : this.data.currentPage + 1,
          hasMore: comments.length >= 20,
          loading: false
        })
        
        // 更新帖子的评论数量
        if (refresh && this.data.postInfo) {
          this.setData({
            'postInfo.commentCount': comments.length
          })
        }
      } else {
        throw new Error(result.result.message || '加载失败')
      }
    } catch (error) {
      console.error('加载评论失败:', error)
      this.setData({ loading: false })
      
      if (!refresh) {
        wx.showToast({
          title: '加载评论失败',
          icon: 'none'
        })
      }
    }
  }
  ,

  // 输入评论内容
  onCommentInput(e) {
    this.setData({
      commentContent: e.detail.value
    });
  },

  // 发布评论
  async publishComment() {
    const { commentContent, replyToComment, userInfo } = this.data;
    
    if (!commentContent || commentContent.length === 0) {
      wx.showToast({
        title: '请输入评论内容',
        icon: 'none'
      });
      return;
    }
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'commentPost',
          postId: this.data.postId,
          content: commentContent,
          userInfo: userInfo || {
            nickName: '匿名用户',
            avatarUrl: '/images/default-avatar.png'
          }
        }
      });
      
      if (result.result.success) {
        // 刷新评论列表
        this.loadComments(true);
        
        this.setData({
          commentContent: '',
          replyToComment: null
        });
        
        wx.showToast({
          title: '评论成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.result.message || '评论失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('发布评论失败:', error);
      // 如果云函数调用失败，使用本地逻辑
      const newComment = {
        id: Date.now(),
        user: userInfo || { nickname: '匿名用户', avatar: '/images/default-avatar.png' },
        content: commentContent,
        createTime: new Date().toISOString(),
        likeCount: 0,
        liked: false,
        replies: [],
        replyTo: replyToComment ? replyToComment.user.nickname : null
      };
      
      if (replyToComment) {
        // 添加到回复列表
        const comments = this.data.comments.map(comment => {
          if (comment.id === replyToComment.id) {
            return {
              ...comment,
              replies: [...comment.replies, newComment]
            };
          }
          return comment;
        });
        this.setData({ comments });
      } else {
        // 添加到评论列表
        const comments = [newComment, ...this.data.comments];
        this.setData({ comments });
      }
      
      this.setData({
        commentContent: '',
        replyToComment: null
      });
      
      wx.showToast({
        title: '评论成功',
        icon: 'success'
      });
    }
  },

  // 点赞帖子
  async togglePostLike() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'likePost',
          postId: this.data.postId
        }
      });
      
      if (result.result.success) {
        const { isLiked, likeCount } = result.result.data;
        this.setData({
          'postInfo.liked': isLiked,
          'postInfo.likeCount': likeCount
        });
        
        // 更新上一页的点赞状态
        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.data.posts) {
          const posts = prevPage.data.posts.map(post => {
            if (post.id === this.data.postId || post._id === this.data.postId) {
              return {
                ...post,
                liked: isLiked,
                likeCount: likeCount
              };
            }
            return post;
          });
          prevPage.setData({ posts });
        }
        
        // 触觉反馈
        wx.vibrateShort();
      }
    } catch (error) {
      console.error('点赞失败:', error);
      // 如果云函数调用失败，使用本地逻辑
      const isLiked = !this.data.postInfo.liked;
      const likeCount = this.data.postInfo.liked ? this.data.postInfo.likeCount - 1 : this.data.postInfo.likeCount + 1;
      
      const postInfo = {
        ...this.data.postInfo,
        liked: isLiked,
        likeCount: likeCount
      };
      
      this.setData({ postInfo });
      
      // 更新上一页的点赞状态
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.data.posts) {
        const posts = prevPage.data.posts.map(post => {
          if (post.id === this.data.postId || post._id === this.data.postId) {
            return {
              ...post,
              liked: isLiked,
              likeCount: likeCount
            };
          }
          return post;
        });
        prevPage.setData({ posts });
      }
      
      wx.vibrateShort();
    }
  },

  // 分享帖子
  sharePost() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    
    // 更新分享数（如果需要）
    const postInfo = {
      ...this.data.postInfo,
      shareCount: (this.data.postInfo.shareCount || 0) + 1
    };
    
    this.setData({ postInfo });
  },

  // 点赞评论
  async toggleCommentLike(e) {
    const commentId = e.currentTarget.dataset.id;
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'communityManager',
        data: {
          action: 'likeComment',
          commentId: commentId
        }
      });
      
      if (result.result.success) {
        const { isLiked, likeCount } = result.result.data;
        const comments = this.data.comments.map(comment => {
          if (comment.id === commentId) {
            return {
              ...comment,
              liked: isLiked,
              likeCount: likeCount
            };
          }
          return comment;
        });
        
        this.setData({ comments });
        wx.vibrateShort();
      }
    } catch (error) {
      console.error('评论点赞失败:', error);
      // 如果云函数调用失败，使用本地逻辑
      const comments = this.data.comments.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            liked: !comment.liked,
            likeCount: comment.liked ? comment.likeCount - 1 : comment.likeCount + 1
          };
        }
        return comment;
      });
      
      this.setData({ comments });
      wx.vibrateShort();
    }
  },

  // 回复评论
  replyComment(e) {
    const commentId = e.currentTarget.dataset.id;
    const comment = this.data.comments.find(c => c.id === commentId);
    
    this.setData({
      replyToComment: comment
    });
  },

  // 取消回复
  cancelReply() {
    this.setData({
      replyToComment: null
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ currentPage: 1 });
    this.loadComments(true);
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadComments();
    }
  },

  // 预览图片
  previewImage(e) {
    const { current, urls } = e.currentTarget.dataset;
    wx.previewImage({
      current,
      urls
    });
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '查看评论 - 咖啡社区',
      path: `/pages/comments/comments?postId=${this.data.postId}`
    };
  }
})