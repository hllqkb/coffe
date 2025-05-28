// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  
  try {
    switch (action) {
      case 'getPosts':
        return await getPosts(event)
      case 'createPost':
        return await createPost(event, wxContext)
      case 'likePost':
        return await likePost(event, wxContext)
      case 'commentPost':
        return await commentPost(event, wxContext)
      case 'getComments':
        return await getComments(event)
      case 'likeComment':
        return await likeComment(event, wxContext)
      case 'deletePost':
        return await deletePost(event, wxContext)
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

// 获取帖子列表
async function getPosts(event) {
  const { page = 1, limit = 10, keyword = '' } = event
  
  let query = db.collection('community_posts')
  
  // 如果有搜索关键词
  if (keyword) {
    query = query.where({
      content: db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    })
  }
  
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

// 创建帖子
async function createPost(event, wxContext) {
  const { content, images = [], video = '', userInfo } = event
  
  if (!content || content.trim() === '') {
    return {
      success: false,
      message: '帖子内容不能为空'
    }
  }
  
  const postData = {
    content: content.trim(),
    images,
    video,
    author: {
      openid: wxContext.OPENID,
      nickname: userInfo.nickName || '匿名用户',
      avatar: userInfo.avatarUrl || '/images/default-avatar.png'
    },
    likes: [],
    likeCount: 0,
    commentCount: 0,
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
  
  const result = await db.collection('community_posts').add({
    data: postData
  })
  
  return {
    success: true,
    data: {
      _id: result._id,
      ...postData
    }
  }
}

// 点赞/取消点赞
async function likePost(event, wxContext) {
  const { postId } = event
  const openid = wxContext.OPENID
  
  // 获取帖子信息
  const post = await db.collection('community_posts').doc(postId).get()
  
  if (!post.data) {
    return {
      success: false,
      message: '帖子不存在'
    }
  }
  
  const likes = post.data.likes || []
  const isLiked = likes.includes(openid)
  
  let updateData
  if (isLiked) {
    // 取消点赞
    updateData = {
      likes: _.pull(openid),
      likeCount: _.inc(-1),
      updateTime: db.serverDate()
    }
  } else {
    // 点赞
    updateData = {
      likes: _.addToSet(openid),
      likeCount: _.inc(1),
      updateTime: db.serverDate()
    }
  }
  
  await db.collection('community_posts').doc(postId).update({
    data: updateData
  })
  
  return {
    success: true,
    data: {
      isLiked: !isLiked,
      likeCount: post.data.likeCount + (isLiked ? -1 : 1)
    }
  }
}

// 评论帖子
async function commentPost(event, wxContext) {
  const { postId, content, userInfo } = event
  
  if (!content || content.trim() === '') {
    return {
      success: false,
      message: '评论内容不能为空'
    }
  }
  
  const commentData = {
    postId,
    content: content.trim(),
    author: {
      openid: wxContext.OPENID,
      nickname: userInfo.nickName || '匿名用户',
      avatar: userInfo.avatarUrl || '/images/default-avatar.png'
    },
    createTime: db.serverDate()
  }
  
  // 添加评论
  const commentResult = await db.collection('community_comments').add({
    data: commentData
  })
  
  // 更新帖子评论数
  await db.collection('community_posts').doc(postId).update({
    data: {
      commentCount: _.inc(1),
      updateTime: db.serverDate()
    }
  })
  
  return {
    success: true,
    data: {
      _id: commentResult._id,
      ...commentData
    }
  }
}

// 获取评论列表
async function getComments(event) {
  const { postId, page = 1, limit = 20 } = event
  
  const result = await db.collection('community_comments')
    .where({
      postId
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

// 点赞/取消点赞评论
async function likeComment(event, wxContext) {
  const { commentId } = event
  const openid = wxContext.OPENID
  
  // 获取评论信息
  const comment = await db.collection('community_comments').doc(commentId).get()
  
  if (!comment.data) {
    return {
      success: false,
      message: '评论不存在'
    }
  }
  
  const likes = comment.data.likes || []
  const isLiked = likes.includes(openid)
  
  let updateData
  if (isLiked) {
    // 取消点赞
    updateData = {
      likes: _.pull(openid),
      likeCount: _.inc(-1)
    }
  } else {
    // 点赞
    updateData = {
      likes: _.addToSet(openid),
      likeCount: _.inc(1)
    }
  }
  
  await db.collection('community_comments').doc(commentId).update({
    data: updateData
  })
  
  return {
    success: true,
    data: {
      isLiked: !isLiked,
      likeCount: comment.data.likeCount + (isLiked ? -1 : 1)
    }
  }
}

// 删除帖子
async function deletePost(event, wxContext) {
  const { postId } = event
  const openid = wxContext.OPENID
  
  // 检查帖子是否存在且是否为作者
  const post = await db.collection('community_posts').doc(postId).get()
  
  if (!post.data) {
    return {
      success: false,
      message: '帖子不存在'
    }
  }
  
  if (post.data.author.openid !== openid) {
    return {
      success: false,
      message: '只能删除自己的帖子'
    }
  }
  
  // 删除帖子
  await db.collection('community_posts').doc(postId).remove()
  
  // 删除相关评论
  await db.collection('community_comments').where({
    postId
  }).remove()
  
  return {
    success: true,
    message: '删除成功'
  }
}