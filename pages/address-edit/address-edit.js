// 地址编辑页面
const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    // 表单数据
    formData: {
      name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      tag: '',
      isDefault: false
    },
    
    // 地址标签选项
    tagOptions: [
      { id: 'home', name: '家', icon: '/images/icons/home.png' },
      { id: 'company', name: '公司', icon: '/images/icons/company.png' },
      { id: 'school', name: '学校', icon: '/images/icons/school.png' },
      { id: 'other', name: '其他', icon: '/images/icons/other.png' }
    ],
    
    // 页面状态
    isEdit: false,
    addressId: null,
    loading: false,
    
    // 地区选择
    showRegionPicker: false,
    regionValue: [0, 0, 0],
    regionText: '请选择省市区'
  },

  onLoad(options) {
    // 预填充地址信息（从定位或编辑）
    if (options.province) {
      this.setData({
        'formData.province': decodeURIComponent(options.province || ''),
        'formData.city': decodeURIComponent(options.city || ''),
        'formData.district': decodeURIComponent(options.district || ''),
        'formData.detail': decodeURIComponent(options.detail || '')
      })
      this.updateRegionText()
    }
    
    // 编辑模式
    if (options.id) {
      this.setData({ 
        isEdit: true, 
        addressId: options.id 
      })
      wx.setNavigationBarTitle({ title: '编辑地址' })
      this.loadAddressData(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '添加地址' })
    }
  },

  // 加载地址数据（编辑模式）
  async loadAddressData(addressId) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const res = await db.collection('user_addresses').doc(addressId).get()
      
      if (res.data) {
        this.setData({
          formData: res.data
        })
        this.updateRegionText()
      }
      
    } catch (error) {
      console.error('加载地址数据失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 更新地区显示文本
  updateRegionText() {
    const { province, city, district } = this.data.formData
    if (province && city && district) {
      this.setData({
        regionText: `${province} ${city} ${district}`
      })
    }
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    
    this.setData({
      [`formData.${field}`]: value
    })
  },

  // 选择地区
  onRegionChange(e) {
    const values = e.detail.value
    const regions = e.detail.regions
    
    // 安全检查
    if (!regions || regions.length < 3) {
      console.error('地区数据不完整:', regions)
      return
    }
    
    this.setData({
      regionValue: values,
      'formData.province': regions[0] || '',
      'formData.city': regions[1] || '',
      'formData.district': regions[2] || '',
      regionText: `${regions[0] || ''} ${regions[1] || ''} ${regions[2] || ''}`
    })
  },

  // 选择标签
  selectTag(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({
      'formData.tag': this.data.formData.tag === tag.id ? '' : tag.id
    })
  },

  // 切换默认地址
  toggleDefault() {
    this.setData({
      'formData.isDefault': !this.data.formData.isDefault
    })
  },



  // 表单验证
  validateForm() {
    const { name, phone, province, city, district, detail } = this.data.formData
    
    if (!name.trim()) {
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' })
      return false
    }
    
    if (!phone.trim()) {
      wx.showToast({ title: '请输入手机号码', icon: 'none' })
      return false
    }
    
    // 手机号格式验证
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return false
    }
    
    if (!province || !city || !district) {
      wx.showToast({ title: '请选择省市区', icon: 'none' })
      return false
    }
    
    if (!detail.trim()) {
      wx.showToast({ title: '请输入详细地址', icon: 'none' })
      return false
    }
    
    return true
  },

  // 保存地址
  async saveAddress() {
    if (!this.validateForm()) return
    
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      wx.showLoading({ title: '保存中...' })
      
      const openid = await app.getOpenId()
      const addressData = {
        ...this.data.formData,
        openid: openid,
        updateTime: Date.now()
      }
      
      if (this.data.isEdit) {
        // 更新地址
        await db.collection('user_addresses').doc(this.data.addressId).update({
          data: addressData
        })
      } else {
        // 新增地址
        addressData.createTime = Date.now()
        
        // 如果设置为默认地址，先取消其他默认地址
        if (addressData.isDefault) {
          await db.collection('user_addresses').where({
            openid: openid,
            isDefault: true
          }).update({
            data: {
              isDefault: false
            }
          })
        }
        
        await db.collection('user_addresses').add({
          data: addressData
        })
      }
      
      wx.showToast({ title: '保存成功', icon: 'success' })
      
      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      
    } catch (error) {
      console.error('保存地址失败:', error)
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ loading: false })
    }
  },

  // 删除地址（编辑模式）
  async deleteAddress() {
    const res = await wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      confirmText: '删除',
      confirmColor: '#ff6b6b'
    })
    
    if (!res.confirm) return
    
    try {
      wx.showLoading({ title: '删除中...' })
      
      await db.collection('user_addresses').doc(this.data.addressId).remove()
      
      wx.showToast({ title: '删除成功', icon: 'success' })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      
    } catch (error) {
      console.error('删除地址失败:', error)
      wx.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  }
})