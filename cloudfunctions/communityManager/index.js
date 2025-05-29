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
      case 'getPostDetail':
        return await getPostDetail(event)
      case 'createPost':
        return await createPost(event, wxContext)
      case 'updatePost':
        return await updatePost(event, wxContext)
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
  
  // 为每个帖子添加id字段并获取云存储文件的临时链接
  const postsWithId = await Promise.all(result.data.map(async (post) => {
    let images = post.images || []
    let video = post.video || ''
    
    // 获取图片的临时链接
    if (images.length > 0) {
      try {
        const imagePromises = images.map(async (fileID) => {
          if (fileID.startsWith('cloud://')) {
            const tempUrlResult = await cloud.getTempFileURL({
              fileList: [fileID]
            })
            return tempUrlResult.fileList[0].tempFileURL
          }
          return fileID
        })
        images = await Promise.all(imagePromises)
      } catch (error) {
        console.error('获取图片临时链接失败:', error)
      }
    }
    
    // 获取视频的临时链接
    if (video && video.startsWith('cloud://')) {
      try {
        const tempUrlResult = await cloud.getTempFileURL({
          fileList: [video]
        })
        video = tempUrlResult.fileList[0].tempFileURL
      } catch (error) {
        console.error('获取视频临时链接失败:', error)
      }
    }
    
    return {
      ...post,
      id: post._id,
      images,
      video
    }
  }))
  
  return {
    success: true,
    data: postsWithId,
    total: postsWithId.length
  }
}

// 创建帖子
async function createPost(event, wxContext) {
  const { content, images = [], video = '' } = event
  
  if (!content || content.trim().length === 0) {
    return {
      success: false,
      message: '内容不能为空'
    }
  }
  
  // 从数据库获取用户最新信息
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
  
  const postData = {
    content: content.trim(),
    images,
    video,
    author: {
      openid: wxContext.OPENID,
      nickname: userInfo.nickName,
      avatar: userInfo.avatarUrl
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

// 获取帖子详情
async function getPostDetail(event) {
  const { postId } = event
  
  if (!postId) {
    return {
      success: false,
      message: '帖子ID不能为空'
    }
  }
  
  try {
    // 获取帖子详情
    const postResult = await db.collection('community_posts').doc(postId).get()
    
    if (!postResult.data) {
      return {
        success: false,
        message: '帖子不存在'
      }
    }
    
    // 获取评论数量（实时统计）
    const commentCountResult = await db.collection('community_comments')
      .where({
        postId: postId
      })
      .count()
    
    // 获取云存储文件的临时链接
    let images = postResult.data.images || []
    let video = postResult.data.video || ''
    
    // 获取图片的临时链接
    if (images.length > 0) {
      try {
        const imagePromises = images.map(async (fileID) => {
          if (fileID.startsWith('cloud://')) {
            const tempUrlResult = await cloud.getTempFileURL({
              fileList: [fileID]
            })
            return tempUrlResult.fileList[0].tempFileURL
          }
          return fileID
        })
        images = await Promise.all(imagePromises)
      } catch (error) {
        console.error('获取图片临时链接失败:', error)
      }
    }
    
    // 获取视频的临时链接
    if (video && video.startsWith('cloud://')) {
      try {
        const tempUrlResult = await cloud.getTempFileURL({
          fileList: [video]
        })
        video = tempUrlResult.fileList[0].tempFileURL
      } catch (error) {
        console.error('获取视频临时链接失败:', error)
      }
    }
    
    // 组装帖子详情数据
    const postDetail = {
      ...postResult.data,
      id: postResult.data._id,
      commentCount: commentCountResult.total,
      images,
      video,
      // 格式化时间
      createTime: formatTime(postResult.data.createTime)
    }
    
    return {
      success: true,
      data: postDetail
    }
  } catch (error) {
    console.error('获取帖子详情失败:', error)
    return {
      success: false,
      message: '获取帖子详情失败'
    }
  }
}

// 时间格式化函数
function formatTime(date) {
  if (!date) return ''
  
  const now = new Date()
  const postTime = new Date(date)
  const diff = now - postTime
  
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  
  if (diff < minute) {
    return '刚刚'
  } else if (diff < hour) {
    return Math.floor(diff / minute) + '分钟前'
  } else if (diff < day) {
    return Math.floor(diff / hour) + '小时前'
  } else {
    return postTime.toLocaleDateString() + ' ' + postTime.toLocaleTimeString().slice(0, 5)
  }
}

// 获取评论列表（增强版）
async function getComments(event) {
  const { postId, page = 1, limit = 20 } = event
  
  try {
    const result = await db.collection('community_comments')
      .where({
        postId
      })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 格式化评论数据
    const comments = result.data.map(comment => ({
      ...comment,
      id: comment._id,
      createTime: formatTime(comment.createTime),
      likeCount: comment.likeCount || 0,
      likes: comment.likes || [],
      user: {
        nickname: comment.author.nickname,
        avatar: comment.author.avatar
      }
    }))
    
    return {
      success: true,
      data: comments
    }
  } catch (error) {
    console.error('获取评论列表失败:', error)
    return {
      success: false,
      message: '获取评论列表失败',
      data: []
    }
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

// 更新帖子
async function updatePost(event, wxContext) {
  const { postId, content, images = [], video = '' } = event
  
  if (!content || content.trim().length === 0) {
    return {
      success: false,
      message: '内容不能为空'
    }
  }
  
  // 检查帖子是否存在
  const post = await db.collection('community_posts').doc(postId).get()
  
  if (!post.data) {
    return {
      success: false,
      message: '帖子不存在'
    }
  }
  
  // 检查是否为帖子作者
  if (post.data.author.openid !== wxContext.OPENID) {
    return {
      success: false,
      message: '只能编辑自己的帖子'
    }
  }
  
  // 更新帖子
  await db.collection('community_posts').doc(postId).update({
    data: {
      content: content.trim(),
      images,
      video,
      updateTime: db.serverDate()
    }
  })
  
  return {
    success: true,
    message: '更新成功'
  }
}

// 删除帖子
async function deletePost(event, wxContext) {
  const { postId } = event
  
  // 检查帖子是否存在
  const post = await db.collection('community_posts').doc(postId).get()
  
  if (!post.data) {
    return {
      success: false,
      message: '帖子不存在'
    }
  }
  
  // 检查是否为帖子作者
  if (post.data.author.openid !== wxContext.OPENID) {
    return {
      success: false,
      message: '只能删除自己的帖子'
    }
  }
  
  // 删除帖子
  await db.collection('community_posts').doc(postId).remove()
  
  // 删除相关评论
  await db.collection('community_comments').where({
    postId: postId
  }).remove()
  
  return {
    success: true,
    message: '删除成功'
  }
}