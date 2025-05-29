// pages/profile/help/help.js
Page({
  data: {
    searchKeyword: '',
    selectedCategory: 'all',
    categories: [
      { id: 'all', name: '全部', icon: '/images/icons/all.png' },
      { id: 'basic', name: '基础操作', icon: '/images/icons/basic.png' },
      { id: 'plant', name: '种植相关', icon: '/images/icons/plant.png' },
      { id: 'shop', name: '商城购买', icon: '/images/icons/shop.png' },
      { id: 'account', name: '账户问题', icon: '/images/icons/account.png' }
    ],
    helpItems: [
      {
        id: 1,
        category: 'basic',
        question: '如何开始种植咖啡树？',
        answer: '1. 进入花园页面\n2. 点击"种植"按钮\n3. 选择咖啡品种\n4. 确认种植位置\n5. 使用水和肥料进行养护',
        tags: ['种植', '新手', '基础'],
        views: 1250
      },
      {
        id: 2,
        category: 'plant',
        question: '咖啡树多久可以收获？',
        answer: '咖啡树的生长周期约为7天，期间需要定期浇水和施肥。当咖啡树成熟后，您就可以进行收获了。收获的咖啡豆可以用来制作各种咖啡产品。',
        tags: ['收获', '生长周期'],
        views: 980
      },
      {
        id: 3,
        category: 'basic',
        question: '如何获得水和肥料？',
        answer: '获得水和肥料的方式：\n1. 每日签到奖励\n2. 完成任务获得\n3. 在商城购买\n4. 邀请好友获得\n5. 参与活动获得',
        tags: ['资源', '获得方式'],
        views: 856
      },
      {
        id: 4,
        category: 'shop',
        question: '如何在商城购买商品？',
        answer: '1. 进入商城页面\n2. 浏览商品分类\n3. 选择需要的商品\n4. 点击购买按钮\n5. 确认订单信息\n6. 选择支付方式\n7. 完成支付',
        tags: ['购买', '商城', '支付'],
        views: 742
      },
      {
        id: 5,
        category: 'account',
        question: '如何修改个人信息？',
        answer: '1. 进入"我的"页面\n2. 点击头像或昵称\n3. 在个人信息页面进行修改\n4. 保存更改',
        tags: ['个人信息', '修改'],
        views: 623
      },
      {
        id: 6,
        category: 'plant',
        question: '为什么我的咖啡树枯萎了？',
        answer: '咖啡树枯萎的可能原因：\n1. 长时间未浇水\n2. 缺少肥料\n3. 遭受病虫害\n\n解决方法：\n1. 及时浇水和施肥\n2. 使用特殊道具治疗\n3. 重新种植新的咖啡树',
        tags: ['枯萎', '养护', '问题'],
        views: 567
      },
      {
        id: 7,
        category: 'basic',
        question: '如何邀请好友？',
        answer: '1. 进入"我的"页面\n2. 点击"邀请好友"\n3. 分享邀请码给好友\n4. 好友使用邀请码注册\n5. 双方都可获得奖励',
        tags: ['邀请', '好友', '奖励'],
        views: 445
      },
      {
        id: 8,
        category: 'account',
        question: '忘记密码怎么办？',
        answer: '本应用使用微信登录，无需设置密码。如果遇到登录问题，请尝试：\n1. 重新授权微信登录\n2. 检查网络连接\n3. 重启应用\n4. 联系客服',
        tags: ['登录', '密码', '问题'],
        views: 334
      }
    ],
    filteredItems: [],
    expandedItems: []
  },

  onLoad() {
    this.filterItems()
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
    this.filterItems()
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      selectedCategory: category
    })
    this.filterItems()
  },

  // 过滤帮助项目
  filterItems() {
    const { helpItems, selectedCategory, searchKeyword } = this.data
    let filtered = helpItems

    // 按分类过滤
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory)
    }

    // 按关键词搜索
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      filtered = filtered.filter(item => 
        item.question.toLowerCase().includes(keyword) ||
        item.answer.toLowerCase().includes(keyword) ||
        item.tags.some(tag => tag.toLowerCase().includes(keyword))
      )
    }

    this.setData({
      filteredItems: filtered
    })
  },

  // 展开/收起答案
  toggleAnswer(e) {
    const itemId = e.currentTarget.dataset.id
    const { expandedItems } = this.data
    const index = expandedItems.indexOf(itemId)
    
    if (index > -1) {
      expandedItems.splice(index, 1)
    } else {
      expandedItems.push(itemId)
      // 增加查看次数
      this.increaseViews(itemId)
    }
    
    this.setData({
      expandedItems: [...expandedItems]
    })
  },

  // 增加查看次数
  increaseViews(itemId) {
    const { helpItems } = this.data
    const item = helpItems.find(item => item.id === itemId)
    if (item) {
      item.views += 1
      this.setData({ helpItems })
      this.filterItems()
    }
  },

  // 联系客服
  contactService() {
    wx.showActionSheet({
      itemList: ['在线客服', '电话客服', '邮件客服'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            wx.showModal({
              title: '在线客服',
              content: '微信客服：coffee_service\n工作时间：9:00-18:00',
              showCancel: false
            })
            break
          case 1:
            wx.makePhoneCall({
              phoneNumber: '400-123-4567'
            })
            break
          case 2:
            wx.setClipboardData({
              data: 'service@coffee.com',
              success: () => {
                wx.showToast({
                  title: '邮箱已复制',
                  icon: 'success'
                })
              }
            })
            break
        }
      }
    })
  },

  // 意见反馈
  goToFeedback() {
    wx.navigateTo({
      url: '/pages/profile/feedback/feedback'
    })
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKeyword: ''
    })
    this.filterItems()
  }
})