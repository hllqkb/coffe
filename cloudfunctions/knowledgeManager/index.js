const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    switch (event.action) {
      case 'getContent':
        return await getContent(event, wxContext)
      case 'getContentDetail':
        return await getContentDetail(event, wxContext)
      case 'addComment':
        return await addComment(event, wxContext)
      case 'getComments':
        return await getComments(event, wxContext)
      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('云函数执行失败:', error)
    return {
      success: false,
      message: '服务器错误',
      error: error.message
    }
  }
}

// 获取知识内容列表
async function getContent(event, wxContext) {
  const { page = 1, limit = 10, category = 'all', keyword = '' } = event
  
  let query = db.collection('coffee_knowledge')
  
  // 分类筛选
  if (category && category !== 'all') {
    query = query.where({
      category: category
    })
  }
  
  // 关键词搜索
  if (keyword) {
    query = query.where({
      title: db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    })
  }
  
  // 分页查询
  const result = await query
    .orderBy('createTime', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get()
  
  return {
    success: true,
    data: result.data,
    total: result.data.length
  }
}

// 获取知识内容详情
async function getContentDetail(event, wxContext) {
  const { contentId } = event
  
  const result = await db.collection('coffee_knowledge').doc(contentId).get()
  
  if (!result.data) {
    return {
      success: false,
      message: '内容不存在'
    }
  }
  
  // 增加浏览次数
  await db.collection('coffee_knowledge').doc(contentId).update({
    data: {
      viewCount: db.command.inc(1)
    }
  })
  
  return {
    success: true,
    data: result.data
  }
}

// 添加评论
async function addComment(event, wxContext) {
  const { contentId, comment } = event
  
  if (!comment || comment.trim().length === 0) {
    return {
      success: false,
      message: '评论内容不能为空'
    }
  }
  
  // 获取用户信息
  let userInfo = {
    nickName: '匿名用户',
    avatarUrl: '/images/default-avatar.png'
  }
  
  try {
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).get()
    
    if (userResult.data && userResult.data.length > 0) {
      const userData = userResult.data[0]
      userInfo = {
        nickName: userData.nickName || '匿名用户',
        avatarUrl: userData.avatarUrl || '/images/default-avatar.png'
      }
    }
  } catch (error) {
    console.log('获取用户信息失败，使用默认信息:', error)
  }
  
  const commentData = {
    contentId,
    comment: comment.trim(),
    author: {
      openid: wxContext.OPENID,
      nickName: userInfo.nickName,
      avatarUrl: userInfo.avatarUrl
    },
    createTime: db.serverDate()
  }
  
  const result = await db.collection('knowledge_comments').add({
    data: commentData
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      ...commentData
    }
  }
}

// 获取评论列表
async function getComments(event, wxContext) {
  const { contentId, page = 1, limit = 20 } = event
  
  const result = await db.collection('knowledge_comments')
    .where({
      contentId: contentId
    })
    .orderBy('createTime', 'desc')
    .skip((page - 1) * limit)
    .limit(limit)
    .get()
  
  return {
    success: true,
    data: result.data
  }
}