// pages/signin/signin.js
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    // 用户信息
    userInfo: {},
    
    // 签到状态
    todayChecked: false,
    checking: false,
    
    // 签到统计
    continuousDays: 0,
    totalDays: 0,
    monthDays: 0,
    
    // 图片路径
    checkinBgPath: '/images/bg/checkin-bg.jpg',
    arrowLeftPath: '/images/icons/arrow-left.png',
    arrowRightPath: '/images/icons/arrow-right.png', 
    successBgPath: '/images/success-bg.png',
    
    // 今日奖励
    todayRewards: [
      { type: 'water', name: '水滴', amount: 10, icon: '/images/water.png' },
      { type: 'fertilizer', name: '肥料', amount: 5, icon: '/images/fertilizer.png' },
      { type: 'coin', name: '金币', amount: 20, icon: '/images/coin.png' }
    ],
    
    // 连续签到奖励
    streakRewards: [
      { day: 1, name: '水滴', amount: '10', icon: '/images/water.png' },
      { day: 2, name: '肥料', amount: '8', icon: '/images/fertilizer.png' },
      { day: 3, name: '金币', amount: '30', icon: '/images/coin.png' },
      { day: 4, name: '水滴', amount: '15', icon: '/images/water.png' },
      { day: 5, name: '肥料', amount: '12', icon: '/images/fertilizer.png' },
      { day: 6, name: '金币', amount: '50', icon: '/images/coin.png' },
      { day: 7, name: '特殊奖励', amount: '1', icon: '/images/icons/special.png' }
    ],
    
    // 日历相关
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    
    // 签到记录
    checkinHistory: [],
    
    // 签到规则
    checkinRules: [
      '每日只能签到一次，错过不可补签',
      '连续签到可获得额外奖励',
      '连续签到7天可获得特殊奖励',
      '签到奖励会自动添加到账户中',
      '签到时间为每日0:00-23:59',
      '断签后连续天数重新计算'
    ],
    
    // 模态框状态
    showSuccessModal: false,
    showRewardModal: false,
    
    // 签到成功数据
    successRewards: [],
    newStreak: false,
    streakEncourage: '',
    
    // 奖励历史
    rewardHistory: [],
    
    // 加载状态
    loading: false,
    
    // 每日任务
    dailyTasks: [
      {
        id: 'water_tree',
        title: '给植物浇水',
        description: '给咖啡树浇水3次',
        icon: '/images/water-icon.png',
        progress: 0,
        target: 3,
        completed: false,
        reward: { type: 'fertilizer', name: '肥料', amount: 5, icon: '/images/fertilizer.png' },
        status: 'available'
      },
      {
        id: 'read_knowledge',
        title: '学习咖啡相关的知识',
        description: '阅读2篇咖啡知识',
        icon: '/images/knowledge-icon.png',
        progress: 0,
        target: 2,
        completed: false,
        reward: { type: 'water', name: '水滴', amount: 15, icon: '/images/water.png' },
        status: 'available'
      },
      {
        id: 'community_interact',
        title: '社区互动',
        description: '在社区点赞或评论5次',
        icon: '/images/community.png',
        progress: 0,
        target: 5,
        completed: false,
        reward: { type: 'coin', name: '金币', amount: 20, icon: '/images/coin.png' },
        status: 'available'
      },
      {
        id: 'harvest_coffee',
        title: '收获咖啡',
        description: '收获成熟的咖啡果实',
        icon: '/images/coffee-beans.png',
        progress: 0,
        target: 1,
        completed: false,
        reward: { type: 'coin', name: '金币', amount: 50, icon: '/images/coin.png' },
        status: 'locked' // 需要有成熟的咖啡树才能解锁
      }
    ]
  },

  onLoad() {
    this.initPage();
    this.downloadImages();
    this.getUserInfo();
  },

  onShow() {
    this.refreshCheckinStatus();
    // 如果全局用户信息已更新，则更新本地用户信息
    if (app.globalData.userInfo && (!this.data.userInfo || this.data.userInfo.nickName !== app.globalData.userInfo.nickName)) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    }
  },
  
  // 获取用户信息
  async getUserInfo() {
    try {
      if (app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo
        });
      } else {
        // 从数据库获取用户信息
        const wxContext = await wx.cloud.callFunction({
          name: 'userLogin'
        });
        
        if (wxContext.result && wxContext.result.success) {
          const userInfo = wxContext.result.data.userInfo;
          this.setData({
            userInfo: userInfo
          });
          
          // 更新全局用户信息
          app.globalData.userInfo = userInfo;
        }
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  },
  
  // 下载图片资源
  downloadImages() {
    // 定义需要下载的图片URL和本地路径映射
    const imageMap = [
      { url: 'https://picsum.photos/800/400?random=1', localPath: 'checkin-bg.jpg' },
      { url: 'https://picsum.photos/32/32?random=2', localPath: 'arrow-left.png' },
      { url: 'https://picsum.photos/32/32?random=3', localPath: 'arrow-right.png' },
      { url: 'https://picsum.photos/64/64?random=4', localPath: 'special.png' },
      { url: 'https://picsum.photos/400/300?random=5', localPath: 'success-bg.png' },
      { url: 'https://picsum.photos/48/48?random=6', localPath: 'water.png' },
      { url: 'https://picsum.photos/48/48?random=7', localPath: 'fertilizer.png' },
      { url: 'https://picsum.photos/48/48?random=8', localPath: 'coin.png' }
    ];
    
    // 使用curl下载每个图片
    imageMap.forEach(item => {
      this.downloadWithCurl(item.url, item.localPath);
    });
    
    // 设置本地图片路径
    this.setLocalImagePaths();
  },
  
  // 使用curl下载文件
  downloadWithCurl(url, filename) {
    const fs = wx.getFileSystemManager();
    const localPath = `${wx.env.USER_DATA_PATH}/${filename}`;
    
    // 先尝试微信小程序的下载方式
    wx.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode === 200) {
          // 保存文件到本地
          fs.saveFile({
            tempFilePath: res.tempFilePath,
            filePath: localPath,
            success: () => {
              console.log('图片下载成功:', filename);
              this.updateImagePath(filename, localPath);
            },
            fail: (err) => {
              console.error('保存图片失败:', err);
              // 如果保存失败，使用网络图片
              this.updateImagePath(filename, url);
            }
          });
        } else {
          console.error('下载图片失败，状态码:', res.statusCode);
          this.updateImagePath(filename, url);
        }
      },
      fail: (err) => {
        console.error('下载图片失败:', err);
        // 下载失败时使用网络图片
        this.updateImagePath(filename, url);
      }
    });
  },
  
  // 更新图片路径
  updateImagePath(filename, path) {
    const updateData = {};
    
    // 根据文件名更新对应的数据
    if (filename === 'checkin-bg.jpg') {
      updateData.checkinBgPath = path;
    } else if (filename === 'arrow-left.png') {
      updateData.arrowLeftPath = path;
    } else if (filename === 'arrow-right.png') {
      updateData.arrowRightPath = path;
    } else if (filename === 'success-bg.png') {
      updateData.successBgPath = path;
    }
    
    this.setData(updateData);
  },
  
  // 设置本地图片路径
  setLocalImagePaths() {
    this.setData({
      checkinBgPath: '/images/bg/checkin-bg.jpg',
      arrowLeftPath: '/images/icons/arrow-left.png', 
      arrowRightPath: '/images/icons/arrow-right.png',
      successBgPath: '/images/success-bg.png'
    });
  },
  
  // 更新奖励图标URL
  updateRewardIcons() {
    // 更新今日奖励图标
    const todayRewards = this.data.todayRewards.map(item => ({
      ...item,
      icon: this.getImageUrl(item.type)
    }));
    
    // 更新连续签到奖励图标
    const streakRewards = this.data.streakRewards.map(item => ({
      ...item,
      icon: this.getImageUrl(item.name.includes('水滴') ? 'water' : 
                           item.name.includes('肥料') ? 'fertilizer' : 
                           item.name.includes('金币') ? 'coin' : 'special')
    }));
    
    this.setData({ todayRewards, streakRewards });
  },
  
  // 获取图片URL
  getImageUrl(type) {
    const urlMap = {
      'water': '/images/water.png',
      'fertilizer': '/images/fertilizer.png',
      'coin': '/images/coin.png',
      'special': '/images/icons/special.png'
    };
    
    return urlMap[type] || '/images/default-avatar.png';
  },
  
  // 获取签到状态
  async getCheckinStatus() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'getCheckinStatus'
        }
      });
      
      if (result.result && result.result.success) {
        const data = result.result.data;
        this.setData({
          todayChecked: data.hasCheckedIn,
          continuousDays: data.consecutiveDays,
          todayRewards: data.todayRewards ? [
            { type: 'water', name: '水滴', amount: data.todayRewards.water, icon: '/images/water.png' },
            { type: 'fertilizer', name: '肥料', amount: data.todayRewards.fertilizer, icon: '/images/fertilizer.png' },
            { type: 'coin', name: '金币', amount: data.todayRewards.coin, icon: '/images/coin.png' }
          ] : this.data.todayRewards,
          streakRewards: data.consecutiveRewards || this.data.streakRewards
        });
      }
    } catch (error) {
      console.error('获取签到状态失败:', error);
    }
  },
  
  // 获取签到历史
  async getCheckinHistory() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'getCheckinHistory',
          limit: 10
        }
      });
      
      if (result.result && result.result.success) {
        this.setData({
          checkinHistory: result.result.data
        });
      }
    } catch (error) {
      console.error('获取签到历史失败:', error);
    }
  },
   
   // 生成日历
   async generateCalendar() {
     try {
       const result = await wx.cloud.callFunction({
         name: 'checkinManager',
         data: {
           action: 'getCheckinCalendar',
           year: this.data.currentYear,
           month: this.data.currentMonth
         }
       });
       
       if (result.result && result.result.success) {
         const data = result.result.data;
         this.setData({
           calendarDays: data.calendar,
           monthDays: data.checkinCount
         });
       }
     } catch (error) {
       console.error('生成日历失败:', error);
       // 如果云函数调用失败，生成本地日历
       this.generateLocalCalendar();
     }
   },
   
   // 生成本地日历（备用方案）
   generateLocalCalendar() {
     const year = this.data.currentYear;
     const month = this.data.currentMonth;
     const firstDay = new Date(year, month - 1, 1);
     const lastDay = new Date(year, month, 0);
     const daysInMonth = lastDay.getDate();
     const startWeekday = firstDay.getDay();
     
     const calendar = [];
     const today = new Date();
     const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
     
     // 添加上个月的日期（填充）
     const prevMonth = month === 1 ? 12 : month - 1;
     const prevYear = month === 1 ? year - 1 : year;
     const prevMonthLastDay = new Date(prevYear, prevMonth, 0).getDate();
     
     for (let i = startWeekday - 1; i >= 0; i--) {
       calendar.push({
         date: prevMonthLastDay - i,
         isCurrentMonth: false,
         hasCheckedIn: false,
         isToday: false
       });
     }
     
     // 添加当月日期
     for (let date = 1; date <= daysInMonth; date++) {
       const dateString = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
       calendar.push({
         date: date,
         isCurrentMonth: true,
         hasCheckedIn: false, // 这里应该从签到记录中获取
         isToday: dateString === todayString,
         dateString: dateString
       });
     }
     
     // 添加下个月的日期（填充到42个格子）
     const remainingCells = 42 - calendar.length;
     for (let date = 1; date <= remainingCells; date++) {
       calendar.push({
         date: date,
         isCurrentMonth: false,
         hasCheckedIn: false,
         isToday: false
       });
     }
     
     this.setData({ calendarDays: calendar });
    },
    
    // 获取连续签到鼓励语
    getStreakEncourage(days) {
      if (days >= 100) {
        return '百日坚持，你是真正的咖啡大师！';
      } else if (days >= 30) {
        return '坚持一个月，习惯已经养成！';
      } else if (days >= 14) {
        return '两周坚持，继续保持！';
      } else if (days >= 7) {
        return '一周连签，棒棒哒！';
      } else if (days >= 3) {
        return '连续签到，越来越棒！';
      } else {
        return '签到成功，继续加油！';
      }
    },
    
    // 上一个月
    prevMonth() {
      let { currentYear, currentMonth } = this.data;
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
      this.setData({ currentYear, currentMonth });
      this.generateCalendar();
    },
    
    // 下一个月
    nextMonth() {
      let { currentYear, currentMonth } = this.data;
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      this.setData({ currentYear, currentMonth });
      this.generateCalendar();
    },
    
    // 关闭成功模态框
    closeSuccessModal() {
      this.setData({ showSuccessModal: false });
    },
    
    // 阻止事件冒泡
    stopPropagation() {
      // 阻止事件冒泡
    },
   
  // 初始化页面
  async initPage() {
    this.setData({ loading: true });
    
    try {
      // 获取用户信息
      if (!this.data.userInfo.nickName) {
        await this.getUserInfo();
      }
      
      // 获取签到状态
      await this.getCheckinStatus();
      
      // 生成日历
      await this.generateCalendar();
      
      // 获取签到历史
      await this.getCheckinHistory();
      
      // 加载每日任务
      await this.loadDailyTasks();
      
      // 移除重复调用
      // await Promise.all([
      //   this.loadCheckinStatus(),
      //   this.generateCalendar(),
      //   this.loadCheckinHistory()
      // ]);
    } catch (error) {
      console.error('初始化页面失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载签到状态
  async loadCheckinStatus() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'getCheckinStatus'
        }
      });

      if (result.result.success) {
        const { todayChecked, continuousDays, totalDays, monthDays } = result.result.data;
        this.setData({
          todayChecked,
          continuousDays,
          totalDays,
          monthDays
        });
      }
    } catch (error) {
      console.error('加载签到状态失败:', error);
    }
  },

  // 刷新签到状态
  async refreshCheckinStatus() {
    await this.loadCheckinStatus();
    this.generateCalendar();
  },

  // 执行签到
  async onCheckin() {
    if (this.data.todayChecked || this.data.checking) return;

    this.setData({ checking: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'checkin'
        }
      });

      if (result.result && result.result.success) {
        const data = result.result.data;
        
        // 格式化奖励数据
        const successRewards = [
          { type: 'water', name: '水滴', amount: data.totalRewards.water, icon: '/images/water.png' },
          { type: 'fertilizer', name: '肥料', amount: data.totalRewards.fertilizer, icon: '/images/fertilizer.png' },
          { type: 'coin', name: '金币', amount: data.totalRewards.coin, icon: '/images/coin.png' }
        ];

        // 更新签到状态
        this.setData({
          todayChecked: true,
          continuousDays: data.consecutiveDays,
          successRewards: successRewards,
          newStreak: data.consecutiveDays % 7 === 0,
          streakEncourage: this.getStreakEncourage(data.consecutiveDays),
          showSuccessModal: true
        });

        // 更新签到任务进度
        await this.updateTaskProgress('daily_checkin', 1);

        // 刷新日历和历史记录
        await this.generateCalendar();
        await this.getCheckinHistory();

        // 触觉反馈
        wx.vibrateShort();

        // 显示成功提示
        wx.showToast({
          title: result.result.message || '签到成功',
          icon: 'success'
        });

      } else {
        wx.showToast({
          title: result.result.message || '签到失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('签到失败:', error);
      wx.showToast({
        title: '签到失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ checking: false });
    }
  },

  // 更新全局资源
  updateGlobalResources(rewards) {
    const app = getApp();
    if (app.globalData.userInfo) {
      rewards.forEach(reward => {
        switch (reward.type) {
          case 'water':
            app.globalData.userInfo.water = (app.globalData.userInfo.water || 0) + reward.amount;
            break;
          case 'fertilizer':
            app.globalData.userInfo.fertilizer = (app.globalData.userInfo.fertilizer || 0) + reward.amount;
            break;
          case 'coin':
            app.globalData.userInfo.coin = (app.globalData.userInfo.coin || 0) + reward.amount;
            break;
        }
      });
    }
  },

  // 获取连续签到鼓励语
  getStreakEncourage(days) {
    if (days === 1) {
      return '开始你的咖啡之旅！';
    } else if (days < 7) {
      return `坚持${7 - days}天可获得特殊奖励！`;
    } else if (days === 7) {
      return '恭喜完成一周连续签到！';
    } else if (days < 30) {
      return '你的坚持让咖啡树更茁壮！';
    } else {
      return '你是真正的咖啡达人！';
    }
  },

  // 生成日历
  generateCalendar() {
    const { currentYear, currentMonth } = this.data;
    const today = new Date();
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startWeekday = firstDay.getDay();
    
    const calendarDays = [];
    
    // 添加上个月的日期
    const prevMonth = new Date(currentYear, currentMonth - 2, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      calendarDays.push({
        day: prevMonthDays - i,
        date: `${currentYear}-${currentMonth - 1}-${prevMonthDays - i}`,
        isOtherMonth: true,
        isToday: false,
        isChecked: false
      });
    }
    
    // 添加当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      const isToday = today.getFullYear() === currentYear && 
                     today.getMonth() + 1 === currentMonth && 
                     today.getDate() === day;
      
      calendarDays.push({
        day,
        date,
        isOtherMonth: false,
        isToday,
        isChecked: this.isDateChecked(date)
      });
    }
    
    // 添加下个月的日期
    const remainingDays = 42 - calendarDays.length; // 6行 * 7列
    for (let day = 1; day <= remainingDays; day++) {
      calendarDays.push({
        day,
        date: `${currentYear}-${currentMonth + 1}-${day}`,
        isOtherMonth: true,
        isToday: false,
        isChecked: false
      });
    }
    
    this.setData({ calendarDays });
  },

  // 检查日期是否已签到
  isDateChecked(date) {
    // 这里应该从服务器获取签到记录，暂时用模拟数据
    const checkedDates = this.data.checkinHistory.map(item => item.date);
    return checkedDates.includes(date);
  },

  // 上一个月
  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth--;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear--;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  // 下一个月
  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    this.setData({ currentYear, currentMonth });
    this.generateCalendar();
  },

  // 加载签到历史
  async loadCheckinHistory() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'getHistory',
          limit: 10
        }
      });

      if (result.result.success) {
        const history = result.result.data.map(item => ({
          ...item,
          dateText: this.formatDate(item.checkinTime),
          timeText: this.formatTime(item.checkinTime)
        }));
        
        this.setData({ checkinHistory: history });
      }
    } catch (error) {
      console.error('加载签到历史失败:', error);
    }
  },

  // 查看全部历史
  viewAllHistory() {
    wx.navigateTo({
      url: '/pages/checkin/history/history'
    });
  },

  // 显示奖励历史
  async showRewardHistory() {
    this.setData({ showRewardModal: true });
    await this.loadRewardHistory();
  },

  // 加载奖励历史
  async loadRewardHistory() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'getRewards',
          type: 'checkin',
          limit: 20
        }
      });

      if (result.result.success) {
        const history = result.result.data.map(item => ({
          ...item,
          dateText: this.formatDate(item.createTime)
        }));
        
        this.setData({ rewardHistory: history });
      }
    } catch (error) {
      console.error('加载奖励历史失败:', error);
    }
  },

  // 关闭成功模态框
  closeSuccessModal() {
    this.setData({ showSuccessModal: false });
  },

  // 关闭奖励模态框
  closeRewardModal() {
    this.setData({ 
      showRewardModal: false,
      rewardHistory: []
    });
  },

  // 格式化日期
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    
    if (this.isSameDay(date, today)) {
      return '今天';
    } else if (this.isSameDay(date, yesterday)) {
      return '昨天';
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  },

  // 格式化时间
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },

  // 判断是否同一天
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await this.refreshCheckinStatus();
    await this.loadCheckinHistory();
    wx.stopPullDownRefresh();
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: `我已连续签到${this.data.continuousDays}天！一起来种咖啡吧`,
      path: '/pages/checkin/checkin',
      imageUrl: '/images/share-checkin.jpg'
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: `连续签到${this.data.continuousDays}天！咖啡树种植计划`,
      imageUrl: '/images/share-checkin.jpg'
    };
  },

  // 加载每日任务
  async loadDailyTasks() {
    try {
      // 从云函数获取任务进度
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'getDailyTasks'
        }
      });

      if (result.result && result.result.success) {
        const serverTasks = result.result.data || [];
        
        // 合并服务器数据和本地任务配置
        const updatedTasks = this.data.dailyTasks.map(localTask => {
          const serverTask = serverTasks.find(t => t.id === localTask.id);
          if (serverTask) {
            return {
              ...localTask,
              progress: serverTask.progress || 0,
              completed: serverTask.completed || false,
              status: serverTask.completed ? 'completed' : 
                     (serverTask.unlocked !== false ? 'available' : 'locked')
            };
          }
          return localTask;
        });

        this.setData({ dailyTasks: updatedTasks });
      } else {
        // 如果云函数调用失败，使用本地默认数据
        console.log('使用本地任务数据');
        this.updateTasksFromLocalData();
      }
    } catch (error) {
      console.error('加载每日任务失败:', error);
      // 使用本地数据作为备用
      this.updateTasksFromLocalData();
    }
  },

  // 使用本地数据更新任务状态
  updateTasksFromLocalData() {
    const updatedTasks = this.data.dailyTasks.map(task => {
      // 根据任务类型和当前状态更新进度
      if (task.id === 'daily_checkin') {
        task.progress = this.data.todayChecked ? 1 : 0;
        task.completed = this.data.todayChecked;
        task.status = this.data.todayChecked ? 'completed' : 'available';
      }
      return task;
    });
    
    this.setData({ dailyTasks: updatedTasks });
  },

  // 更新任务进度
  async updateTaskProgress(taskId, progress) {
    try {
      // 调用云函数更新任务进度
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'updateTaskProgress',
          taskId: taskId,
          progress: progress
        }
      });

      if (result.result && result.result.success) {
        // 重新加载任务数据
        await this.loadDailyTasks();
        
        // 检查是否有任务完成
        const completedTask = result.result.data.completedTask;
        if (completedTask) {
          this.showTaskCompletionReward(completedTask);
        }
      }
    } catch (error) {
      console.error('更新任务进度失败:', error);
    }
  },

  // 显示任务完成奖励
  showTaskCompletionReward(task) {
    wx.showModal({
      title: '任务完成！',
      content: `恭喜完成「${task.title}」，获得${task.reward.name} x${task.reward.amount}！`,
      showCancel: false,
      confirmText: '太棒了',
      success: () => {
        // 可以在这里添加动画效果或其他反馈
      }
    });
  },

  // 领取任务奖励
  async claimTaskReward(taskId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'checkinManager',
        data: {
          action: 'claimTaskReward',
          taskId: taskId
        }
      });

      if (result.result && result.result.success) {
        wx.showToast({
          title: '奖励已领取',
          icon: 'success'
        });
        
        // 重新加载任务数据
        await this.loadDailyTasks();
      } else {
        wx.showToast({
          title: result.result.message || '领取失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('领取任务奖励失败:', error);
      wx.showToast({
        title: '领取失败',
        icon: 'none'
      });
    }
  },

  // 任务点击事件
  onTaskTap(e) {
    const { taskId } = e.currentTarget.dataset;
    const task = this.data.dailyTasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    if (task.status === 'locked') {
      wx.showToast({
        title: '任务暂未解锁',
        icon: 'none'
      });
      return;
    }
    
    if (task.completed) {
      wx.showToast({
        title: '任务已完成',
        icon: 'success'
      });
      return;
    }
    
    // 根据任务类型执行相应操作
    this.executeTask(task);
  },

  // 执行任务
  executeTask(task) {
    switch (task.id) {
      case 'daily_checkin':
        if (!this.data.todayChecked) {
          this.onCheckin();
        }
        break;
      case 'water_tree':
        wx.navigateTo({
          url: '/pages/garden/garden'
        });
        break;
      case 'read_knowledge':
        wx.navigateTo({
          url: '/pages/knowledge/knowledge'
        });
        break;
      case 'community_interact':
        wx.navigateTo({
          url: '/pages/community/community'
        });
        break;
      case 'harvest_coffee':
        wx.navigateTo({
          url: '/pages/garden/garden'
        });
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  }
});