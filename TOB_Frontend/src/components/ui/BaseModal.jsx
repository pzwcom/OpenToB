import { Modal } from 'antd'

const widthMap = {
  sm: 420,
  md: 640,
  lg: 860,
}

export default function BaseModal({ isOpen, onClose, title = '', size = 'md', children, footer }) {
  return (
    <Modal
      title={title}
      open={isOpen}
      onCancel={onClose}
      footer={footer ?? null}
      width={widthMap[size]}
      centered
    >
      {children}
    </Modal>
  )
}
