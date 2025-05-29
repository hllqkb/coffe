const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    switch (event.action) {
      case 'getVarieties':
        return await getVarieties()
      case 'initVarieties':
        return await initVarieties()
      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}

// 获取咖啡品种列表
async function getVarieties() {
  try {
    const result = await db.collection('coffee_varieties')
      .orderBy('id', 'asc')
      .get()
    
    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取咖啡品种失败:', error)
    return {
      success: false,
      message: '获取咖啡品种失败',
      data: []
    }
  }
}

// 初始化咖啡品种数据（仅在数据库为空时执行）
async function initVarieties() {
  try {
    // 检查是否已有数据
    const existingData = await db.collection('coffee_varieties').count()
    
    if (existingData.total > 0) {
      return {
        success: true,
        message: '数据已存在，无需初始化'
      }
    }
    
    // 初始化咖啡品种数据
    const varieties = [
      {
        id: 1,
        name: '阿拉比卡',
        description: '世界上最受欢迎的咖啡品种，口感温和香甜',
        growthTime: 180,
        image: '/images/arabica.png',
        createTime: db.serverDate()
      },
      {
        id: 2,
        name: '罗布斯塔',
        description: '咖啡因含量较高，口感浓郁苦涩',
        growthTime: 150,
        image: '/images/robusta.png',
        createTime: db.serverDate()
      },
      {
        id: 3,
        name: '蓝山',
        description: '牙买加蓝山咖啡，被誉为咖啡中的极品',
        growthTime: 200,
        image: '/images/blue-mountain.png',
        createTime: db.serverDate()
      },
      {
        id: 4,
        name: '瑰夏',
        description: '巴拿马瑰夏，花香浓郁，口感独特',
        growthTime: 220,
        image: '/images/geisha.png',
        createTime: db.serverDate()
      }
    ]
    
    // 批量插入数据
    const insertPromises = varieties.map(variety => 
      db.collection('coffee_varieties').add({ data: variety })
    )
    
    await Promise.all(insertPromises)
    
    return {
      success: true,
      message: '咖啡品种数据初始化成功'
    }
  } catch (error) {
    console.error('初始化咖啡品种数据失败:', error)
    return {
      success: false,
      message: '初始化失败'
    }
  }
}