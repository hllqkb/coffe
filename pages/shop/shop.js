// pages/shop/shop.js
Page({
  data: {
    // 用户资源
    userResources: {
      water: 0,
      fertilizer: 0,
      coin: 0
    },
    
    // 分类数据
    categories: [
      { id: 'water', name: '水滴', icon: '/images/icons/water.png' },
      { id: 'fertilizer', name: '肥料', icon: '/images/icons/fertilizer.png' }
    ],
    activeCategory: 'water', // 默认显示水滴
    currentCategoryName: '水滴',
    

    
    // 商品列表
    allProducts: [
      // 水滴类
      {
        id: 'w1',
        name: '清澈水滴',
        description: '基础浇水道具，满足咖啡树日常需求',
        price: 10,
        originalPrice: null,
        priceIcon: '/images/icons/coin.png',
        image: '/images/products/water-basic.jpg',
        category: 'water',
        tags: ['基础', '日常'],
        badge: null,
        discount: null
      },
      {
        id: 'w2',
        name: '纯净水滴',
        description: '高品质水滴，加速咖啡树成长',
        price: 20,
        originalPrice: 25,
        priceIcon: '/images/icons/coin.png',
        image: '/images/products/water-pure.jpg',
        category: 'water',
        tags: ['高品质', '加速'],
        badge: '推荐',
        discount: 8
      },
      {
        id: 'w3',
        name: '神奇水滴',
        description: '稀有水滴，大幅提升咖啡树品质',
        price: 50,
        originalPrice: null,
        priceIcon: '/images/icons/coin.png',
        image: '/images/products/water-magic.jpg',
        category: 'water',
        tags: ['稀有', '品质'],
        badge: '限量',
        discount: null
      },
      
      // 肥料类
      {
        id: 'f1',
        name: '有机肥料',
        description: '天然有机肥料，促进根系发育',
        price: 15,
        originalPrice: null,
        priceIcon: '/images/icons/coin.png',
        image: '/images/products/fertilizer-organic.jpg',
        category: 'fertilizer',
        tags: ['有机', '根系'],
        badge: null,
        discount: null
      },
      {
        id: 'f2',
        name: '复合肥料',
        description: '营养全面的复合肥料，均衡发展',
        price: 30,
        originalPrice: 35,
        priceIcon: '/images/icons/coin.png',
        image: '/images/products/fertilizer-compound.jpg',
        category: 'fertilizer',
        tags: ['复合', '均衡'],
        badge: '热销',
        discount: 8.5
      },
      {
        id: 'f3',
        name: '特效肥料',
        description: '专业配方肥料，显著提升产量',
        price: 80,
        originalPrice: null,
        priceIcon: '/images/icons/coin.png',
        image: '/images/products/fertilizer-special.jpg',
        category: 'fertilizer',
        tags: ['专业', '产量'],
        badge: '新品',
        discount: null
      },
      
    ],
    
    filteredProducts: [],

    

    
    // 模态框状态
    showBuyModal: false,
    showSuccessModal: false,
    
    // 购买相关
    selectedItem: null,
    buyQuantity: 1,
    totalPrice: 0,
    currentBalance: 0,
    canAfford: false,
    purchasing: false,
    
    // 购买成功数据
    successMessage: '',
    purchasedItems: [],
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.loadUserResources();
  },

  // 初始化页面
  async initPage() {
    this.setData({ loading: true });
    
    try {
      await this.loadUserResources();
      this.filterProducts();
    } catch (error) {
      console.error('初始化页面失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载用户资源
  async loadUserResources() {
    try {
      const app = getApp();
      if (app.globalData.userInfo) {
        this.setData({
          userResources: {
            water: app.globalData.userInfo.water || 0,
            fertilizer: app.globalData.userInfo.fertilizer || 0,
            coin: app.globalData.userInfo.coin || 0
          }
        });
      } else {
        // 从数据库获取用户资源
        const db = wx.cloud.database();
        const openid = await app.getOpenId();
        
        const userRes = await db.collection('users').where({
          openid: openid
        }).get();
        
        if (userRes.data.length > 0) {
          const userData = userRes.data[0];
          this.setData({
            userResources: {
              water: userData.water || 0,
              fertilizer: userData.fertilizer || 0,
              coin: userData.coin || 0
            }
          });
        }
      }
    } catch (error) {
      console.error('加载用户资源失败:', error);
    }
  },

  // 分类切换
  onCategoryChange(e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find(cat => cat.id === categoryId);
    
    this.setData({
      activeCategory: categoryId,
      currentCategoryName: category ? category.name : '' // 修改默认名称
    });
    
    this.filterProducts();
  },

  // 筛选商品
  filterProducts() {
    const { allProducts, activeCategory } = this.data;
    // 只显示当前选中的分类，不再有 'all' 的情况
    const filtered = allProducts.filter(product => product.category === activeCategory);
    this.setData({ filteredProducts: filtered });
  },

  // 点击商品
  onItemTap(e) {
    const item = e.currentTarget.dataset.item;
    this.showBuyModal(item);
  },

  // 点击购买按钮
  onBuyTap(e) {
    e.stopPropagation();
    const item = e.currentTarget.dataset.item;
    this.showBuyModal(item);
  },

  // 显示购买模态框
  showBuyModal(item) {
    const { userResources } = this.data;
    const priceType = this.getPriceType(item.priceIcon);
    const currentBalance = userResources[priceType] || 0;
    const totalPrice = item.price;
    
    this.setData({
      selectedItem: item,
      buyQuantity: 1,
      totalPrice,
      currentBalance,
      canAfford: currentBalance >= totalPrice,
      showBuyModal: true
    });
  },

  // 获取价格类型
  getPriceType(priceIcon) {
    if (priceIcon.includes('water')) return 'water';
    if (priceIcon.includes('fertilizer')) return 'fertilizer';
    return 'coin';
  },

  // 增加数量
  increaseQuantity() {
    const { buyQuantity, selectedItem, userResources } = this.data;
    const newQuantity = buyQuantity + 1;
    const priceType = this.getPriceType(selectedItem.priceIcon);
    const totalPrice = selectedItem.price * newQuantity;
    const currentBalance = userResources[priceType] || 0;
    
    this.setData({
      buyQuantity: newQuantity,
      totalPrice,
      canAfford: currentBalance >= totalPrice
    });
  },

  // 减少数量
  decreaseQuantity() {
    const { buyQuantity, selectedItem, userResources } = this.data;
    if (buyQuantity <= 1) return;
    
    const newQuantity = buyQuantity - 1;
    const priceType = this.getPriceType(selectedItem.priceIcon);
    const totalPrice = selectedItem.price * newQuantity;
    const currentBalance = userResources[priceType] || 0;
    
    this.setData({
      buyQuantity: newQuantity,
      totalPrice,
      canAfford: currentBalance >= totalPrice
    });
  },

  // 确认购买
  async confirmPurchase() {
    if (!this.data.canAfford || this.data.purchasing) return;
    
    this.setData({ purchasing: true });
    
    try {
      const { selectedItem, buyQuantity, totalPrice } = this.data;
      const priceType = this.getPriceType(selectedItem.priceIcon);
      
      const result = await wx.cloud.callFunction({
        name: 'purchaseItem',
        data: {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          quantity: buyQuantity,
          totalPrice,
          priceType,
          itemType: selectedItem.category
        }
      });
      
      if (result.result.success) {
        // 更新用户资源
        const newResources = { ...this.data.userResources };
        newResources[priceType] -= totalPrice;
        
        // 添加购买的道具
        if (selectedItem.category === 'water') {
          newResources.water = (newResources.water || 0) + buyQuantity;
        } else if (selectedItem.category === 'fertilizer') {
          newResources.fertilizer = (newResources.fertilizer || 0) + buyQuantity;
        }
        
        this.setData({
          userResources: newResources,
          showBuyModal: false,
          showSuccessModal: true,
          successMessage: `成功购买 ${selectedItem.name} × ${buyQuantity}`,
          purchasedItems: [{
            type: selectedItem.category,
            name: selectedItem.name,
            amount: buyQuantity,
            icon: selectedItem.image
          }]
        });
        
        // 更新全局数据
        this.updateGlobalResources(newResources);
        
        // 刷新购买记录
        this.loadPurchaseHistory();
        
        // 触觉反馈
        wx.vibrateShort();
        
      } else {
        wx.showToast({
          title: result.result.message || '购买失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('购买失败:', error);
      wx.showToast({
        title: '购买失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ purchasing: false });
    }
  },



  // 更新全局资源
  updateGlobalResources(resources) {
    const app = getApp();
    if (app.globalData.userInfo) {
      Object.assign(app.globalData.userInfo, resources);
    }
  },



  // 关闭购买模态框
  closeBuyModal() {
    this.setData({
      showBuyModal: false,
      selectedItem: null,
      buyQuantity: 1,
      purchasing: false
    });
  },

  // 关闭成功模态框
  closeSuccessModal() {
    this.setData({
      showSuccessModal: false,
      successMessage: '',
      purchasedItems: []
    });
  },

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return `${Math.floor(diff / 86400000)}天前`;
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.loadUserResources();
    wx.stopPullDownRefresh();
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '咖啡道具商店 - 助力咖啡树成长',
      path: '/pages/shop/shop',
      imageUrl: '/images/share-shop.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '咖啡道具商店 - 助力咖啡树成长',
      imageUrl: '/images/share-shop.jpg'
    };
  }
});