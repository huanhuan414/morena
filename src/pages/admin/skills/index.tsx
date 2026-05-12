import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import { unwrapList, unwrapObject } from '@/utils/api-response'
import './index.css'

interface Skill {
  id: string
  name: string
  description: string
  icon: string
  category: string
  price: number
  status: 'active' | 'inactive'
  order_count: number
  rating: number
  created_at: string
}

export default function SkillManagement() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '🔧',
    category: 'general',
    price: 0
  })

  useEffect(() => {
    fetchSkills()
  }, [])

  const fetchSkills = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/skills' })
      if (res.data.code === 200) {
        setSkills(unwrapList(res.data.data) as Skill[])
        setTotal(unwrapObject(res.data.data, { total: 0 }).total)
      }
    } catch (err) {
      console.error('获取技能列表失败:', err)
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.description) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }

    try {
      const url = editingSkill 
        ? `/api/admin/skills/${editingSkill.id}` 
        : '/api/admin/skills'
      const method = editingSkill ? 'PUT' : 'POST'

      const res = await Network.request({
        url,
        method,
        data: formData
      })

      if (res.data.code === 200) {
        Taro.showToast({ 
          title: editingSkill ? '更新成功' : '创建成功', 
          icon: 'success' 
        })
        setShowModal(false)
        setEditingSkill(null)
        setFormData({ name: '', description: '', icon: '🔧', category: 'general', price: 0 })
        fetchSkills()
      }
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setFormData({
      name: skill.name,
      description: skill.description,
      icon: skill.icon,
      category: skill.category,
      price: skill.price
    })
    setShowModal(true)
  }

  const handleDelete = (skillId: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除该技能吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await Network.request({
              url: `/api/admin/skills/${skillId}`,
              method: 'DELETE'
            })
            if (result.data.code === 200) {
              Taro.showToast({ title: '删除成功', icon: 'success' })
              fetchSkills()
            }
          } catch (err) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }

  const handleToggleStatus = async (skill: Skill) => {
    const newStatus = skill.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await Network.request({
        url: `/api/admin/skills/${skill.id}/status`,
        method: 'PUT',
        data: { status: newStatus }
      })
      if (res.data.code === 200) {
        Taro.showToast({ 
          title: newStatus === 'active' ? '已上架' : '已下架', 
          icon: 'success' 
        })
        fetchSkills()
      }
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const categories = [
    { key: 'general', label: '通用' },
    { key: 'writing', label: '写作' },
    { key: 'coding', label: '编程' },
    { key: 'design', label: '设计' },
    { key: 'analysis', label: '分析' }
  ]

  return (
    <AdminLayout title="技能管理">
      <View className="skills-page">
        {/* 顶部操作栏 */}
        <View className="page-header">
          <Text className="header-title">技能列表 ({total})</Text>
          <Button 
            className="add-btn"
            onClick={() => {
              setEditingSkill(null)
              setFormData({ name: '', description: '', icon: '🔧', category: 'general', price: 0 })
              setShowModal(true)
            }}
          >
            <Plus size={18} color="#fff" />
            <Text className="btn-text">新增技能</Text>
          </Button>
        </View>

        {/* 技能列表 */}
        <View className="skills-grid">
          {skills.map(skill => (
            <View key={skill.id} className={`skill-card ${skill.status}`}>
              <View className="skill-header">
                <Text className="skill-icon">{skill.icon}</Text>
                <View className={`status-tag ${skill.status}`}>
                  <Text className="status-tag-text">
                    {skill.status === 'active' ? '已上架' : '已下架'}
                  </Text>
                </View>
              </View>
              
              <Text className="skill-name">{skill.name}</Text>
              <Text className="skill-desc">{skill.description}</Text>
              
              <View className="skill-meta">
                <Text className="skill-category">
                  {categories.find(c => c.key === skill.category)?.label || '通用'}
                </Text>
                <Text className="skill-price">¥{skill.price}</Text>
              </View>
              
              <View className="skill-stats">
                <Text className="stat-item">{skill.order_count}次购买</Text>
                <Text className="stat-item">{skill.rating}分</Text>
              </View>
              
              <View className="skill-actions">
                <View className="action-btn" onClick={() => handleEdit(skill)}>
                  <Pencil size={16} color="#3b82f6" />
                </View>
                <View className="action-btn" onClick={() => handleToggleStatus(skill)}>
                  <Eye size={16} color={skill.status === 'active' ? '#ef4444' : '#10b981'} />
                </View>
                <View className="action-btn delete" onClick={() => handleDelete(skill.id)}>
                  <Trash2 size={16} color="#ef4444" />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* 新增/编辑弹窗 */}
        {showModal && (
          <View className="modal-overlay">
            <View className="modal-content">
              <Text className="modal-title">
                {editingSkill ? '编辑技能' : '新增技能'}
              </Text>
              
              <View className="form-group">
                <Text className="form-label">技能名称</Text>
                <Input
                  className="form-input"
                  placeholder="请输入技能名称"
                  value={formData.name}
                  onInput={(e: any) => setFormData({...formData, name: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">技能描述</Text>
                <Input
                  className="form-input"
                  placeholder="请输入技能描述"
                  value={formData.description}
                  onInput={(e: any) => setFormData({...formData, description: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">图标</Text>
                <Input
                  className="form-input"
                  placeholder="请输入emoji图标"
                  value={formData.icon}
                  onInput={(e: any) => setFormData({...formData, icon: e.detail?.value || ''})}
                />
              </View>
              
              <View className="form-group">
                <Text className="form-label">价格 (元)</Text>
                <Input
                  className="form-input"
                  type="number"
                  placeholder="请输入价格"
                  value={String(formData.price)}
                  onInput={(e: any) => setFormData({...formData, price: Number(e.detail?.value) || 0})}
                />
              </View>
              
              <View className="modal-footer">
                <Button className="cancel-btn" onClick={() => setShowModal(false)}>
                  <Text className="cancel-text">取消</Text>
                </Button>
                <Button className="save-btn" onClick={handleSave}>
                  <Text className="save-text">保存</Text>
                </Button>
              </View>
            </View>
          </View>
        )}
      </View>
    </AdminLayout>
  )
}
