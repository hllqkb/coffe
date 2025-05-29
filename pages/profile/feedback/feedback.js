// pages/profile/feedback/feedback.js
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    feedbackType: 'bug', // bug, suggestion, other
    content: '',
    contact: '',
    images: [],
    submitting: false,
    typeOptions: [
      { id: 'bug', name: '问题反馈', icon: '/images/icons/bug.png' },
      { id: 'suggestion', name: '建议意见', icon: '/images/icons/suggestion.png' },
      { id: 'other', name: '其他', icon: '/images/icons/other.png' }
    ]
  },

  onLoad() {
    // 页面加载时的初始化
  },

  // 选择反馈类型
  selectFeedbackType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      feedbackType: type
    })
  },

  // 输入反馈内容
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    })
  },

  // 输入联系方式
  onContactInput(e) {
    this.setData({
      contact: e.detail.value
    })
  },

  // 选择图片
  chooseImage() {
    const { images } = this.data
    const maxCount = 3 - images.length
    
    if (maxCount <= 0) {
      wx.showToast({
        title: '最多上传3张图片',
        icon: 'none'
      })
      return
    }

    wx.chooseMedia({
      count: maxCount,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map(file => ({
          path: file.tempFilePath,
          size: file.size
        }))
        
        this.setData({
          images: [...images, ...newImages]
        })
      }
    })
  },

  // 删除图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const { images } = this.data
    images.splice(index, 1)
    this.setData({ images })
  },

  // 预览图片
  previewImage(e) {
    const index = e.currentTarget.dataset.index
    const { images } = this.data
    const urls = images.map(img => img.path)
    
    wx.previewImage({
      current: urls[index],
      urls: urls
    })
  },

  // 提交反馈
  async submitFeedback() {
    const { feedbackType, content, contact, images, submitting } = this.data
    
    if (submitting) return
    
    // 验证表单
    if (!content.trim()) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      })
      return
    }
    
    if (content.trim().length < 10) {
      wx.showToast({
        title: '反馈内容至少10个字符',
        icon: 'none'
      })
      return
    }

    try {
      this.setData({ submitting: true })
      wx.showLoading({ title: '提交中...' })
      
      const openid = app.globalData.openid
      const userInfo = app.globalData.userInfo
      
      // 上传图片
      const imageUrls = []
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const cloudPath = `feedback/${openid}/${Date.now()}_${i}.jpg`
        
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: image.path
        })
        
        imageUrls.push(uploadRes.fileID)
      }
      
      // 提交反馈
      await db.collection('user_feedback').add({
        data: {
          openid,
          userInfo: {
            nickName: userInfo?.nickName || '匿名用户',
            avatarUrl: userInfo?.avatarUrl || ''
          },
          type: feedbackType,
          content: content.trim(),
          contact: contact.trim(),
          images: imageUrls,
          status: 'pending', // pending, processing, resolved
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      
      wx.hideLoading()
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      })
      
      // 重置表单
      this.setData({
        content: '',
        contact: '',
        images: []
      })
      
      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      
    } catch (error) {
      console.error('提交反馈失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 查看反馈历史
  viewFeedbackHistory() {
    wx.navigateTo({
      url: '/pages/profile/feedback-history/feedback-history'
    })
  },

  // 联系客服
  contactService() {
    wx.showModal({
      title: '联系客服',
      content: '您可以通过以下方式联系我们：\n\n微信客服：coffee_service\n邮箱：service@coffee.com\n电话：400-123-4567',
      showCancel: false,
      confirmText: '我知道了'
    })
  }
})