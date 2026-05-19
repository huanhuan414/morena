import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import './index.css'

const PrivacyPolicy: React.FC = () => {
  return (
    <View className="policy-page">
      <View className="policy-header">
        <Text className="policy-title">「莫瑞娜AI」隐私政策</Text>
        <Text className="policy-version">更新日期：2026年5月19日</Text>
        <Text className="policy-date">生效日期：2026年5月19日</Text>
      </View>

      <View className="policy-content">
        <View className="policy-section">
          <Text className="section-content">
            欢迎您使用我们的「莫瑞娜AI」应用（以下简称"本应用"）。我们深知个人信息对您的重要性，并庄严承诺保护您的隐私安全。本隐私政策旨在清晰地说明我们在您使用本应用的服务过程中，如何收集、使用、存储、共享和保护您的个人信息，并告知您如何行使对个人信息的权利。
          </Text>
          <Text className="section-content">
            特别提示：我们的产品基于京东Taro框架开发，应用运行期间需要收集您的设备唯一识别码（IMEI/android ID/DEVICE_ID/IDFA、SIM卡IMSI信息、OAID）以提供统计分析服务，并通过应用启动数据及异常错误日志分析改进性能和用户体验，为用户提供更好的服务。
          </Text>
          <Text className="section-content">
            请您在使用我们的服务前，仔细阅读并充分理解本隐私政策的全部内容。一旦您开始使用或继续使用我们的服务，即表示您已完全同意本隐私政策的内容，并授权我们按照本政策的规定收集、使用和存储您的相关信息。
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">1. 我们如何收集和使用个人信息</Text>
          <Text className="section-content">
            我们收集信息是为了向您提供安全、高效的服务体验。我们收集的信息种类和用途如下：
          </Text>

          <Text className="section-content">
            <Text className="content-title">1.1 为您提供核心AI分身服务</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">AI分身创建：当您创建AI分身时，我们会收集您设置的分身名称、性格描述、技能配置等信息。这些信息是创建个性化分身所必需的。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">AI内容生成：当您使用内容生成功能时，我们会收集您输入的订单需求、主题要求、风格偏好等信息，用于生成符合您需求的文案、图片或视频内容。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">订单服务：当您发布或承接订单时，我们会收集订单标题、描述、预算、截止时间等信息，用于订单匹配和管理。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">分身互动：当您与AI分身进行语音通话或消息聊天时，我们会收集您的语音输入和文字消息，用于实现互动功能。</Text>
          </Text>

          <Text className="section-content">
            <Text className="content-title">1.2 相机与麦克风权限</Text>
          </Text>
          <Text className="section-content">
            如果您选择通过拍照、上传相册图片或录制音频作为分身头像或互动素材，我们会在您授权后访问您的相机和麦克风。您随时可以在设备设置中关闭这些权限。
          </Text>

          <Text className="section-content">
            <Text className="content-title">1.3 存储权限</Text>
          </Text>
          <Text className="section-content">
            为了保存您生成的内容到本地相册或设备，以及读取您选择上传的本地文件，我们需要访问您的设备存储权限。
          </Text>

          <Text className="section-content">
            <Text className="content-title">1.4 保障应用基础运行与网络通信</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">网络权限：这是应用连接互联网服务器以提供所有AI服务的基础。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">Wi-Fi状态权限：用于监测Wi-Fi连接状态，优化网络请求，为您节省流量并提供更稳定的服务。</Text>
          </Text>

          <Text className="section-content">
            <Text className="content-title">1.5 设备识别与统计分析</Text>
          </Text>
          <Text className="section-content">
            我们会收集您的设备唯一标识符（如IMEI、Android ID、OAID、设备序列号）、设备型号、操作系统版本等信息。这些信息用于：
          </Text>
          <Text className="section-content">
            <Text className="content-item">账号安全：辅助验证账号，防止恶意登录。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">数据分析：统计用户量、分析应用故障（如崩溃、错误），从而改进产品和用户体验。</Text>
          </Text>

          <Text className="section-content">
            <Text className="content-title">1.6 其他功能权限</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">振动权限：用于在特定操作（如订单接单成功、收到消息通知）时提供触觉反馈，提升交互体验。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">唤醒锁定：防止设备在长时间生成任务（如生成视频）时进入休眠状态，确保任务顺利完成。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">电话状态：主要用于获取设备标识，用于安全风控。</Text>
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">2. 数据使用过程中涉及的合作方以及转移、公开个人信息</Text>

          <Text className="section-content">
            <Text className="content-title">2.1 合作方处理</Text>
          </Text>
          <Text className="section-content">
            为实现本政策所述目的，我们的某些服务会由合作的第三方供应商、服务提供商或代理（如云服务器供应商、数据分析服务商、支付处理商）提供支持。我们只会出于合法、正当、必要的目的共享您的信息，并且会通过合同等方式要求他们按照我们的说明、本政策以及其他任何相关的保密和安全措施来处理信息。
          </Text>
          <Text className="section-content">
            我们接入的第三方SDK包括但不限于：
          </Text>
          <Text className="section-content">
            <Text className="content-item">DCloud uni-app SDK：需要收集您的设备信息以提供基础运行环境。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">阿里云/腾讯云等云服务SDK：用于提供AI模型运算、数据存储和内容分发网络（CDN）服务。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">微信SDK：如果您使用支付服务，我们需要集成支付SDK以处理订单和支付信息。</Text>
          </Text>

          <Text className="section-content">
            <Text className="content-title">2.2 转移与公开</Text>
          </Text>
          <Text className="section-content">
            原则上，我们不会将您的个人信息转移或公开给任何无关的第三方。除非在以下情况下：
          </Text>
          <Text className="section-content">
            <Text className="content-item">获得您的明确同意。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">根据法律法规、法律程序、诉讼或政府主管部门的强制性要求。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">为保护我们、我们的用户或公众的权益、财产或安全免遭损害而有必要提供。</Text>
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">3. 管理您的个人信息</Text>
          <Text className="section-content">
            我们尽力保障您对自己的个人信息行使以下权利：
          </Text>
          <Text className="section-content">
            <Text className="content-item">访问与更正：您可以在应用内的【个人中心】中访问和修改您的账号信息、头像、昵称等。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">删除与撤回同意：您可以通过注销账号的方式，要求我们删除您的个人信息。您也可以在设备系统中关闭相机、存储等权限。</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">投诉举报：如果您认为我们对您个人信息的处理损害了您的合法权益，您可以通过本政策第8节提供的联系方式与我们联系。</Text>
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">4. 我们如何保护个人信息的安全</Text>
          <Text className="section-content">
            我们采用符合行业标准的安全防护措施，包括加密技术、匿名化处理、访问控制等，以防止您的个人信息遭到未经授权的访问、使用、修改、损坏或丢失。
          </Text>
          <Text className="section-content">
            我们会定期组织安全培训和应急演练，以提高我们应对安全事件的能力。尽管有上述安全措施，但请注意，任何互联网传输方式或电子存储方法都存在潜在风险，我们无法保证信息的绝对安全。
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">5. 我们如何存储个人信息</Text>
          <Text className="section-content">
            <Text className="content-title">存储地点：</Text>我们在中华人民共和国境内运营中收集和产生的个人信息，将存储在境内。
          </Text>
          <Text className="section-content">
            <Text className="content-title">存储期限：</Text>我们仅为实现目的所必需的最短时间保留您的个人信息。超出保存期限后，我们将对您的个人信息进行删除或匿名化处理。
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">6. 未成年人条款</Text>
          <Text className="section-content">
            我们非常重视对未成年人个人信息的保护。如果您是未满18周岁的未成年人，请在您的父母或其他监护人的陪同下仔细阅读本政策，并在征得您的父母或监护人同意的前提下使用我们的服务或向我们提供信息。
          </Text>
          <Text className="section-content">
            如果我们发现自己在未获得可证实的监护人同意的情况下收集了未成年人的个人信息，我们会设法尽快删除相关数据。如果您认为我们可能不当地持有关于未成年人的信息，请立即联系我们。
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">7. 隐私政策的查阅和修订</Text>
          <Text className="section-content">
            为了给您提供更好的服务，本政策可能会不时更新。我们会在本页面发布更新后的版本，并通过显著方式（如应用内弹窗、通知等）提醒您相关内容的更新，更新后的协议自发布之日起生效。
          </Text>
          <Text className="section-content">
            请您定期查阅本政策，以便及时了解任何更改。您继续使用我们的服务即表示您接受修订后的隐私政策。
          </Text>
        </View>

        <View className="policy-section">
          <Text className="section-title">8. 联系我们</Text>
          <Text className="section-content">
            如果您对本隐私政策或我们的个人信息处理实践有任何疑问、意见、建议或需要行使相关权利，请通过以下方式与我们联系：
          </Text>
          <Text className="section-content">
            <Text className="content-item">客服邮箱：369751361@qq.com</Text>
          </Text>
          <Text className="section-content">
            <Text className="content-item">联系地址：贵州省贵安新区党武镇贵安数字经济产业园-24#地块-1-7-3</Text>
          </Text>
          <Text className="section-content">
            一般情况下，我们将在收到您的要求后的15个工作日内予以回复。
          </Text>
        </View>
      </View>

      <View className="policy-footer">
        <Text className="footer-text">© 2025 莫瑞娜AI 版权所有</Text>
      </View>
    </View>
  )
}

export default PrivacyPolicy