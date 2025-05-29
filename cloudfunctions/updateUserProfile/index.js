// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { avatarUrl, nickName, signature } = event
  
  try {
    // 更新用户信息
    const result = await db.collection('users').where({
      openid: wxContext.OPENID
    }).update({
      data: {
        avatarUrl: avatarUrl || '',
        nickName: nickName || '',
        signature: signature || '',
        updateTime: new Date()
      }
    })
    
    // 如果没有找到用户记录，则创建新记录
    if (result.stats.updated === 0) {
      await db.collection('users').add({
        data: {
          openid: wxContext.OPENID,
          avatarUrl: avatarUrl || '',
          nickName: nickName || '',
          signature: signature || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })
    }
    
    return {
      success: true,
      message: '更新成功'
    }
  } catch (error) {
    console.error('更新用户信息失败:', error)
    return {
      success: false,
      message: '更新失败',
      error: error.message
    }
  }
}