// 地址管理页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    addresses: [],
    loading: true,
    isSelectMode: false, // 是否为选择地址模式
    selectedAddressId: null
  },

  onLoad(options) {
    // 检查是否为选择地址模式
    if (options.select === 'true') {
      this.setData({ 
        isSelectMode: true,
        selectedAddressId: options.selectedId || null
      })
      wx.setNavigationBarTitle({ title: '选择收货地址' })
    }
    
    this.loadAddresses()
  },

  onShow() {
    // 每次显示页面时刷新地址列表
    this.loadAddresses()
  },

  // 加载地址列表
  async loadAddresses() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const openid = await app.getOpenId()
      const res = await db.collection('user_addresses').where({
        openid: openid
      }).orderBy('isDefault', 'desc').orderBy('createTime', 'desc').get()
      
      const addresses = res.data.map(address => ({
        ...address,
        fullAddress: `${address.province}${address.city}${address.district}${address.detail}`
      }))
      
      this.setData({ 
        addresses,
        loading: false
      })
      
    } catch (error) {
      console.error('加载地址失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 选择地址（选择模式下）
  selectAddress(e) {
    if (!this.data.isSelectMode) return
    
    const address = e.currentTarget.dataset.address
    
    // 返回选中的地址
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    
    if (prevPage) {
      prevPage.setData({
        selectedAddress: address
      })
      
      // 如果有回调函数，执行回调
      if (prevPage.onAddressSelected) {
        prevPage.onAddressSelected(address)
      }
    }
    
    wx.navigateBack()
  },

  // 添加新地址
  addAddress() {
    wx.navigateTo({
      url: '/pages/address-edit/address-edit'
    })
  },

  // 编辑地址
  editAddress(e) {
    const address = e.currentTarget.dataset.address
    wx.navigateTo({
      url: `/pages/address-edit/address-edit?id=${address._id}`
    })
  },

  // 删除地址
  async deleteAddress(e) {
    const address = e.currentTarget.dataset.address
    
    const res = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      confirmText: '删除',
      confirmColor: '#ff6b6b'
    })
    
    if (!res.confirm) return
    
    try {
      wx.showLoading({ title: '删除中...' })
      
      await db.collection('user_addresses').doc(address._id).remove()
      
      wx.showToast({ title: '删除成功', icon: 'success' })
      this.loadAddresses()
      
    } catch (error) {
      console.error('删除地址失败:', error)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 设置默认地址
  async setDefaultAddress(e) {
    const address = e.currentTarget.dataset.address
    
    if (address.isDefault) {
      wx.showToast({ title: '已是默认地址', icon: 'none' })
      return
    }
    
    try {
      wx.showLoading({ title: '设置中...' })
      
      const openid = await app.getOpenId()
      
      // 先取消所有默认地址
      await db.collection('user_addresses').where({
        openid: openid,
        isDefault: true
      }).update({
        data: {
          isDefault: false
        }
      })
      
      // 设置新的默认地址
      await db.collection('user_addresses').doc(address._id).update({
        data: {
          isDefault: true
        }
      })
      
      wx.showToast({ title: '设置成功', icon: 'success' })
      this.loadAddresses()
      
    } catch (error) {
      console.error('设置默认地址失败:', error)
      wx.showToast({ title: '设置失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 获取当前位置
  async getCurrentLocation() {
    try {
      wx.showLoading({ title: '定位中...' })
      
      // 获取用户授权
      const authRes = await wx.getSetting()
      if (!authRes.authSetting['scope.userLocation']) {
        const res = await wx.authorize({ scope: 'scope.userLocation' })
        if (!res) {
          wx.showToast({ title: '需要位置权限', icon: 'none' })
          return
        }
      }
      
      // 获取当前位置
      const locationRes = await wx.getLocation({
        type: 'gcj02'
      })
      
      // 逆地理编码获取地址信息
      const reverseRes = await wx.cloud.callFunction({
        name: 'locationManager',
        data: {
          action: 'reverseGeocode',
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
      })
      
      if (reverseRes.result.success) {
        const addressInfo = reverseRes.result.data
        
        // 跳转到地址编辑页面，预填充位置信息
        wx.navigateTo({
          url: `/pages/address-edit/address-edit?province=${addressInfo.province}&city=${addressInfo.city}&district=${addressInfo.district}&detail=${addressInfo.street}`
        })
      } else {
        throw new Error(reverseRes.result.message)
      }
      
    } catch (error) {
      console.error('获取位置失败:', error)
      wx.showToast({ title: '定位失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadAddresses().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})