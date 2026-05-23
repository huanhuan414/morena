import{l as x,m as d,j as e,V as n,o as a,ah as b,a$ as u,aJ as y,H as k,ao as w,ay as N,M as c,aN as v,bw as C,bd as q,x as S}from"./vendors.5443dd0e.js";var m=[{id:"1",category:"create",question:"如何创建AI分身？",answer:`1. 点击底部"分身"Tab
2. 点击"创建分身"按钮
3. 填写分身名称、描述
4. 设置性格特点和技能
5. 上传头像
6. 点击"创建完成"`},{id:"2",category:"create",question:"分身性格怎么设置？",answer:`在创建或编辑分身时，可以设置：
• 性格标签：活泼、稳重、幽默、专业等
• 说话风格：正式、随意、亲切等
• 知识领域：选择擅长的技能
• 回复偏好：简短、详细、有趣等`},{id:"3",category:"hosting",question:"什么是分身托管？",answer:`分身托管是指让你的AI分身24小时在线，自动为其他用户提供服务。你可以：
• 设置服务价格
• 选择服务时间
• 查看服务统计
• 获得托管收益`},{id:"4",category:"hosting",question:"如何开启托管赚钱？",answer:`1. 进入分身详情页
2. 点击"托管设置"
3. 开启"自动托管"开关
4. 设置服务价格
5. 确认托管时间
6. 点击"开启托管"

收益将自动计入你的账户`},{id:"5",category:"order",question:"如何发布技能订单？",answer:`1. 点击底部"我的"→"发布订单"
2. 选择订单类型
3. 填写订单详情
4. 设置价格和截止时间
5. 选择执行的分身
6. 确认发布

分身将自动帮你完成订单`},{id:"6",category:"order",question:"订单完成后怎么收钱？",answer:`订单完成后：
1. 买家确认收货
2. 系统自动结算
3. 收益进入"我的钱包"
4. 可申请提现到微信/支付宝

提现一般1-3个工作日到账`},{id:"7",category:"earn",question:"怎么邀请好友赚钱？",answer:`1. 进入"我的"→"推广中心"
2. 复制你的专属邀请码
3. 分享给好友
4. 好友注册并完成首单
5. 你获得佣金奖励

佣金比例：好友消费的10%`},{id:"8",category:"earn",question:"有哪些赚钱方式？",answer:`平台提供多种赚钱方式：
• 分身托管：24小时自动服务赚钱
• 发布订单：出售技能服务
• 邀请好友：推广佣金10%
• 任务奖励：完成新手任务
• 活动奖励：参与平台活动`}],z=[{key:"all",label:"全部",icon:v},{key:"create",label:"创建分身",icon:C},{key:"hosting",label:"托管赚钱",icon:u},{key:"order",label:"发布订单",icon:c},{key:"earn",label:"赚钱攻略",icon:c}];function E(){var t=x.useState("all"),o=d(t,2),r=o[0],h=o[1],f=x.useState(null),i=d(f,2),l=i[0],p=i[1],g=r==="all"?m:m.filter(function(s){return s.category===r});return e.jsxs(n,{className:"flex flex-col min-h-screen bg-gray-50",children:[e.jsxs(n,{className:"bg-gradient-to-r from-indigo-500 to-purple-500 px-5 pt-8 pb-6",children:[e.jsx(a,{className:"block text-2xl font-bold text-white mb-1",children:"新手指南"}),e.jsx(a,{className:"block text-sm text-white opacity-80",children:"快速了解如何创建分身、托管赚钱"})]}),e.jsx(n,{className:"flex flex-row gap-2 px-4 py-4 overflow-x-auto bg-white",children:z.map(function(s){return e.jsxs(n,{className:"flex flex-col items-center gap-1 px-3 py-2 rounded-full flex-shrink-0 ".concat(r===s.key?"bg-blue-50 border border-blue-200":"bg-gray-50 border border-transparent"),onClick:function(){return h(s.key)},children:[e.jsx(s.icon,{size:22,color:r===s.key?"#3b82f6":"#6b7280"}),e.jsx(a,{className:"block text-xs whitespace-nowrap ".concat(r===s.key?"text-blue-500 font-medium":"text-gray-500"),children:s.label})]},s.key)})}),e.jsx(n,{className:"px-4 pb-3",children:e.jsxs(n,{className:"flex flex-row items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100",onClick:function(){return b({title:"视频教程开发中",icon:"none"})},children:[e.jsx(n,{className:"w-12 h-12 rounded-full bg-red-100 flex items-center justify-center",children:e.jsx(u,{size:24,color:"#ef4444"})}),e.jsxs(n,{className:"flex-1",children:[e.jsx(a,{className:"block text-base font-semibold text-gray-800",children:"视频教程"}),e.jsx(a,{className:"block text-sm text-gray-500 mt-1",children:"3分钟学会所有功能"})]}),e.jsx(y,{size:18,color:"#9ca3af"})]})}),e.jsxs(k,{className:"flex-1 px-4 pb-6",scrollY:!0,children:[e.jsx(a,{className:"block text-base font-semibold text-gray-800 mb-3 mt-1",children:"常见问题"}),g.map(function(s){return e.jsxs(n,{className:"mb-2 bg-white rounded-xl overflow-hidden shadow-sm",children:[e.jsxs(n,{className:"flex flex-row items-center justify-between px-4 py-3",onClick:function(){return p(l===s.id?null:s.id)},children:[e.jsx(a,{className:"block text-base flex-1 pr-3 ".concat(l===s.id?"text-blue-500 font-medium":"text-gray-800"),children:s.question}),l===s.id?e.jsx(w,{size:18,color:"#6b7280",className:"flex-shrink-0"}):e.jsx(N,{size:18,color:"#6b7280",className:"flex-shrink-0"})]}),l===s.id&&e.jsx(n,{className:"px-4 pb-4 border-t border-gray-100",children:e.jsx(a,{className:"block text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-wrap",children:s.answer})})]},s.id)})]}),e.jsx(n,{className:"px-4 py-5 bg-white border-t border-gray-100",children:e.jsxs(n,{className:"flex flex-row items-center justify-center gap-2",onClick:function(){return b({title:"客服功能开发中",icon:"none"})},children:[e.jsx(a,{className:"block text-sm text-gray-500",children:"还有其他问题？"}),e.jsxs(n,{className:"flex flex-row items-center gap-1",children:[e.jsx(c,{size:16,color:"#3b82f6"}),e.jsx(a,{className:"block text-sm text-blue-500 font-medium",children:"联系客服"})]})]})})]})}function T(){var t=function(){S.navigateBack()};return e.jsxs(n,{className:"help-page",children:[e.jsxs(n,{className:"nav-bar",children:[e.jsx(n,{className:"nav-back",onClick:t,children:e.jsx(q,{size:24,color:"#1f2937"})}),e.jsx(n,{className:"nav-title",children:"帮助中心"}),e.jsx(n,{className:"nav-placeholder"})]}),e.jsx(E,{})]})}export{T as default};
