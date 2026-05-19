import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import './index.css'

const UserAgreement: React.FC = () => {
  return (
    <View className="agreement-page">
      <View className="agreement-header">
        <Text className="agreement-title">「莫瑞娜AI」用户协议</Text>
        <Text className="agreement-version">更新日期：2026年5月19日</Text>
        <Text className="agreement-date">生效日期：2026年5月19日</Text>
      </View>

      <View className="agreement-content">
        <View className="agreement-section">
          <Text className="section-content">
            欢迎您使用「莫瑞娜AI应用」（以下简称"本应用"）。请您仔细阅读以下条款，如果您未满18周岁，请在法定监护人的陪同下阅读本协议。您使用我们的服务即表示您已同意本协议内容。
          </Text>
          <Text className="section-content">
            <Text className="highlight-text">重要提示：</Text>本协议是您与应用开发者之间关于使用AI智能体应用服务所订立的协议。本协议内容涵盖了您使用本应用的权利义务，请仔细阅读。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">1. 服务内容</Text>
          <Text className="section-content">
            本应用是一款提供AI分身创作与服务的应用程序，包括但不限于：
          </Text>
          <Text className="section-content">
            <Text className="content-item">AI分身创建：根据您的设定创建个性化AI分身，包括名称、性格、技能等属性配置</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">AI内容生成：根据订单需求生成文案、图片、视频等各类内容</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">订单服务：发布创作订单、承接任务、订单管理与结算</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">分身互动：与AI分身进行语音通话、消息聊天等交互</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">社交功能：好友管理、社交互动、内容分享</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">其他AI相关功能服务</Text>
          </Text>
          <Text className="section-content">
            我们保留随时变更、中断或终止部分或全部服务的权利，且不需对用户或任何第三方负责。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">2. 账户注册与安全</Text>
          <Text className="section-content">
            <Text className="content-title">2.1</Text>您注册时应提供真实、准确、完整和最新的资料，并及时更新这些资料。
          </Text>
          <Text className="section-content">
            <Text className="content-title">2.2</Text>您有责任保管好账户密码，并对使用该账户的所有活动负责。
          </Text>
          <Text className="section-content">
            <Text className="content-title">2.3</Text>如果您发现任何未经授权的账户使用行为，应立即通知我们。
          </Text>
          <Text className="section-content">
            <Text className="content-title">2.4</Text>我们保留根据实际情况收回账户的权利。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">3. 用户行为规范</Text>
          <Text className="section-content">
            <Text className="content-title">3.1</Text>您同意不会利用本应用从事以下活动：
          </Text>
          <Text className="section-content">
            <Text className="content-item">违反国家法律法规的行为</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">上传、生成或分享含有色情、暴力、仇恨内容或其它违法信息</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">侵犯他人知识产权、商业秘密或隐私权</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">进行任何可能对互联网网络正常运行造成损害的行为</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">上传或生成任何含有病毒、木马等恶意代码的内容</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">恶意刷单、刷量或扰乱平台秩序</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">其他我们认为不当的行为</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-title">3.2</Text>您理解并同意，AI生成内容可能存在不准确或偏见，您应对生成内容进行审慎判断，特别是对于重要决策不应完全依赖AI生成内容。
          </Text>
          <Text className="section-content">
            <Text className="content-title">3.3</Text>您应独自承担使用本应用生成内容所产生的一切法律责任。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">4. 知识产权</Text>
          <Text className="section-content">
            <Text className="content-title">4.1</Text>本应用提供的服务中包含的各类知识产权归我们或相关权利人所有。
          </Text>
          <Text className="section-content">
            <Text className="content-title">4.2</Text>您通过本应用生成的内容的知识产权归属如下：
          </Text>
          <Text className="section-content">
            <Text className="content-item">您保留对提示词（输入内容）的权利</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">对于生成的内容，在您遵守本协议的前提下，您获得生成的特定内容的使用权</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">我们保留对AI模型及其输出的权利</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-title">4.3</Text>您不得对本应用进行反向工程、反编译或试图提取源代码。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">5. 隐私保护</Text>
          <Text className="section-content">
            <Text className="content-title">5.1</Text>我们重视用户的隐私保护，关于我们如何收集、使用、存储和保护您的个人信息，请详细阅读《隐私政策》。
          </Text>
          <Text className="section-content">
            特别说明：我们的产品基于京东Taro框架开发，应用运行期间需要收集您的设备唯一识别码（IMEI/android ID/DEVICE_ID/IDFA、SIM卡IMSI信息、OAID）以提供统计分析服务，并通过应用启动数据及异常错误日志分析改进性能和用户体验，为用户提供更好的服务。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">6. 服务变更与终止</Text>
          <Text className="section-content">
            <Text className="content-title">6.1</Text>我们可能随时变更、暂停或终止部分或全部服务，且无需事先通知。
          </Text>
          <Text className="section-content">
            <Text className="content-title">6.2</Text>如您违反本协议，我们有权随时暂停或终止向您提供服务。
          </Text>
          <Text className="section-content">
            <Text className="content-title">6.3</Text>服务终止后，我们有权永久删除您的数据且不承担任何责任。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">7. 免责声明</Text>
          <Text className="section-content">
            <Text className="content-title">7.1</Text>本应用按"现状"提供，我们不提供任何形式的保证。
          </Text>
          <Text className="section-content">
            <Text className="content-title">7.2</Text>我们不保证服务不会中断，也不保证服务的及时性、安全性和准确性。
          </Text>
          <Text className="section-content">
            <Text className="content-title">7.3</Text>您使用本应用所生成内容的风险由您自行承担。
          </Text>
          <Text className="section-content">
            <Text className="content-title">7.4</Text>因不可抗力导致的服务中断，我们不承担任何责任。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">8. 协议修改</Text>
          <Text className="section-content">
            我们有权随时修改本协议的任何条款。一旦协议内容发生变动，我们会在应用内公布修改后的协议。如果您不同意修改的内容，请立即停止使用本应用。继续使用则视为接受修改后的协议。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">9. 适用法律与争议解决</Text>
          <Text className="section-content">
            <Text className="content-title">9.1</Text>本协议的订立、执行和解释及争议的解决均应适用中华人民共和国法律。
          </Text>
          <Text className="section-content">
            <Text className="content-title">9.2</Text>如双方就本协议内容或其执行发生任何争议，双方应尽量友好协商解决；协商不成时，任何一方均可向我们所在地的人民法院提起诉讼。
          </Text>
        </View>

        <View className="agreement-section">
          <Text className="section-title">10. 其他条款</Text>
          <Text className="section-content">
            <Text className="content-title">10.1</Text>本协议构成您与我们之间就使用本服务的完整协议。
          </Text>
          <Text className="section-content">
            <Text className="content-title">10.2</Text>如果我们未执行本协议的任何权利或规定，不构成对该权利或规定的放弃。
          </Text>
          <Text className="section-content">
            <Text className="content-title">10.3</Text>如果本协议的任何条款被认定为无效或不可执行，该条款应被重新解释以反映各方原意，其余条款仍然有效。
          </Text>
        </View>
      </View>

      <View className="agreement-footer">
        <Text className="footer-text">© 2025 莫瑞娜AI 版权所有</Text>
      </View>
    </View>
  )
}

export default UserAgreement