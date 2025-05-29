// 初始化地址数据的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 检查是否已有 user_addresses 集合
    const collections = await db.listCollections();
    const hasAddressCollection = collections.collections.some(col => col.name === 'user_addresses');
    
    if (!hasAddressCollection) {
      // 创建集合（通过添加一个临时文档然后删除来创建集合）
      const tempDoc = await db.collection('user_addresses').add({
        data: {
          temp: true,
          createTime: new Date()
        }
      });
      
      // 删除临时文档
      await db.collection('user_addresses').doc(tempDoc._id).remove();
      
      return {
        success: true,
        message: '成功创建 user_addresses 集合'
      };
    } else {
      return {
        success: true,
        message: 'user_addresses 集合已存在'
      };
    }
  } catch (error) {
    console.error('初始化地址数据失败:', error);
    return {
      success: false,
      message: '初始化地址数据失败',
      error: error.message
    };
  }
};