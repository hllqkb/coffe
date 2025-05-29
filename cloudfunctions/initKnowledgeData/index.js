// 初始化咖啡知识数据的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 示例咖啡知识数据
const knowledgeData = [
  {
    title: '咖啡豆的种植环境',
    category: 'planting',
    content: '咖啡豆的种植需要特定的气候条件，包括适宜的温度、湿度和海拔高度。最佳种植区域通常位于南北回归线之间的咖啡带。',
    summary: '了解咖啡豆种植的基本环境要求',
    image: '/images/coffee-environment.png',
    author: '咖啡专家',
    viewCount: 0,
    likeCount: 0,
    createTime: new Date(),
    updateTime: new Date()
  },
  {
    title: '咖啡豆的处理方法',
    category: 'processing',
    content: '咖啡豆的处理方法主要有水洗法、日晒法和蜜处理法。不同的处理方法会影响咖啡的风味特征。',
    summary: '探索不同咖啡豆处理方法对风味的影响',
    image: '/images/coffee-processing.png',
    author: '咖啡专家',
    viewCount: 0,
    likeCount: 0,
    createTime: new Date(),
    updateTime: new Date()
  },
  {
    title: '手冲咖啡的基本技巧',
    category: 'brewing',
    content: '手冲咖啡需要掌握水温、研磨度、冲泡时间等关键要素。推荐水温在90-96度之间，研磨度为中细研磨。',
    summary: '掌握手冲咖啡的核心技巧',
    image: '/images/hand-brewing.png',
    author: '咖啡师',
    viewCount: 0,
    likeCount: 0,
    createTime: new Date(),
    updateTime: new Date()
  },
  {
    title: '咖啡品鉴的基础知识',
    category: 'tasting',
    content: '咖啡品鉴包括观察、闻香、品尝三个步骤。需要注意咖啡的酸度、苦味、甜度、香气和口感等方面。',
    summary: '学习专业的咖啡品鉴方法',
    image: '/images/coffee-tasting.png',
    author: '品鉴师',
    viewCount: 0,
    likeCount: 0,
    createTime: new Date(),
    updateTime: new Date()
  },
  {
    title: '咖啡文化的历史发展',
    category: 'culture',
    content: '咖啡起源于埃塞俄比亚，后传播到阿拉伯世界，再传入欧洲和美洲。每个地区都发展出了独特的咖啡文化。',
    summary: '追溯咖啡文化的历史足迹',
    image: '/images/coffee-history.png',
    author: '文化学者',
    viewCount: 0,
    likeCount: 0,
    createTime: new Date(),
    updateTime: new Date()
  },
  {
    title: '咖啡对健康的影响',
    category: 'health',
    content: '适量饮用咖啡对健康有益，可以提高注意力、促进新陈代谢。但过量饮用可能导致失眠、心悸等问题。',
    summary: '了解咖啡对人体健康的正面和负面影响',
    image: '/images/coffee-health.png',
    author: '营养师',
    viewCount: 0,
    likeCount: 0,
    createTime: new Date(),
    updateTime: new Date()
  }
];

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 检查是否已有数据
    const existingData = await db.collection('coffee_knowledge').get();
    
    if (existingData.data.length === 0) {
      // 批量添加数据
      const promises = knowledgeData.map(item => 
        db.collection('coffee_knowledge').add({ data: item })
      );
      
      await Promise.all(promises);
      
      return {
        success: true,
        message: `成功添加 ${knowledgeData.length} 条咖啡知识数据`
      };
    } else {
      return {
        success: true,
        message: `数据库中已有 ${existingData.data.length} 条数据，无需重复添加`
      };
    }
  } catch (error) {
    console.error('初始化数据失败:', error);
    return {
      success: false,
      message: '初始化数据失败',
      error: error.message
    };
  }
};