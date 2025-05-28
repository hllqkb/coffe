// pages/checkin/checkin.js
Page({
  data: {
    // 签到状态
    todayChecked: false,
    checking: false,
    
    // 签到统计
    continuousDays: 0,
    totalDays: 0,
    monthDays: 0,
    
    // 今日奖励
    todayRewards: [
      { type: 'water', name: '水滴', amount: 10, icon: '/images/icons/water.png' },
      { type: 'fertilizer', name: '肥料', amount: 5, icon: '/images/icons/fertilizer.png' },
      { type: 'coin', name: '金币', amount: 20, icon: '/images/icons/coin.png' }
    ],
    
    // 连续签到奖励
    streakRewards: [
      { day: 1, name: '水滴', amount: '10', icon: '/images/icons/water.png' },
      { day: 2, name: '肥料', amount: '8', icon: '/images/icons/fertilizer.png' },
      { day: 3, name: '金币', amount: '30', icon: '/images/icons/coin.png' },
      { day: 4, name: '水滴', amount: '15', icon: '/images/icons/water.png' },
      { day: 5, name: '肥料', amount: '12', icon: '/images/icons/fertilizer.png' },
      { day: 6, name: '金币', amount: '50', icon: '/images/icons/coin.png' },
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
    loading: false
  },

  onLoad() {
    this.initPage();
  },

  onShow() {
    this.refreshCheckinStatus();
  },

  // 初始化页面
  async initPage() {
    this.setData({ loading: true });
    
    try {
      await Promise.all([
        this.loadCheckinStatus(),
        this.generateCalendar(),
        this.loadCheckinHistory()
      ]);
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
        name: 'getCheckinStatus'
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
        name: 'doCheckin'
      });

      if (result.result.success) {
        const { 
          continuousDays, 
          totalDays, 
          monthDays, 
          rewards, 
          isNewStreak 
        } = result.result.data;

        // 更新签到状态
        this.setData({
          todayChecked: true,
          continuousDays,
          totalDays,
          monthDays,
          successRewards: rewards,
          newStreak: isNewStreak,
          streakEncourage: this.getStreakEncourage(continuousDays),
          showSuccessModal: true
        });

        // 刷新日历和历史记录
        this.generateCalendar();
        this.loadCheckinHistory();

        // 触觉反馈
        wx.vibrateShort();

        // 更新全局用户资源
        this.updateGlobalResources(rewards);

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
        name: 'getCheckinHistory',
        data: {
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
        name: 'getRewardHistory',
        data: {
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
  }
});