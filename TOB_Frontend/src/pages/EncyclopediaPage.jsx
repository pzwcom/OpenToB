import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { useIntl } from 'react-intl'
import { Empty, Input, Tabs, Tooltip } from 'antd'
import BaseModal from '../components/ui/BaseModal.jsx'
import { searchEncyclopedia } from '../utils/encyclopediaIndex.js'
import './EncyclopediaPage.less'

const { Search } = Input

function EncyclopediaPage() {
  const { formatMessage } = useIntl()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [activeSub, setActiveSub] = useState('')
  const [detail, setDetail] = useState(null)

  const groups = useMemo(() => searchEncyclopedia(query), [query])

  const currentCategory = groups.find((g) => g.category === activeCategory) || groups[0] || null
  const currentSub =
    currentCategory?.subs.find((s) => s.name === activeSub) ||
    currentCategory?.subs[0] ||
    null

  function handleSearch(value) {
    const q = (value || '').trim()
    setQuery(q)
    setActiveCategory('')
    setActiveSub('')
    setDetail(null)
  }

  return (
    <div className="ency">
      <div className="ency__header">
        <h2 className="ency__title">{formatMessage({ id: 'encyclopedia.title' })}</h2>
      </div>
      <div className="ency__search">
        <Search
          placeholder={formatMessage({ id: 'encyclopedia.searchPlaceholder' })}
          allowClear
          enterButton
          size="large"
          onSearch={handleSearch}
        />
      </div>

      {groups.length === 0 ? (
        <div className="ency__empty">
          <Empty
            description={
              query
                ? formatMessage({ id: 'encyclopedia.noResult' }, { query })
                : formatMessage({ id: 'encyclopedia.enterQuery' })
            }
          />
        </div>
      ) : (
        <div className="ency__body">
          <Tabs
            activeKey={currentCategory ? currentCategory.category : ''}
            onChange={(key) => {
              setActiveCategory(key)
              setActiveSub('')
            }}
            className="ency__cat-tabs"
            items={groups.map((g) => ({
              key: g.category,
              label: (
                <span>
                  {formatMessage({ id: `encyclopedia.category.${g.category}` })}
                  <span className="ency__cat-count">{g.total}</span>
                </span>
              ),
              children: null,
            }))}
          />

          {currentCategory && (
            <>
              <Tabs
                activeKey={currentSub ? currentSub.name : ''}
                onChange={setActiveSub}
                size="small"
                className="ency__sub-tabs"
                items={currentCategory.subs.map((s) => ({
                  key: s.name,
                  label: (
                    <span>
                      {s.name}
                      <span className="ency__cat-count">{s.count}</span>
                    </span>
                  ),
                  children: null,
                }))}
              />

              {currentSub && (
                <div className="ency__list">
                  {currentSub.items.map((item) => (
                    <div
                      key={item.id}
                      className="ency__card"
                      onClick={() => setDetail(item)}
                    >
                      {item.image && (
                        <div className="ency__card-thumb">
                          <img
                            src={encodeURI(item.image)}
                            alt={item.name}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      <div className="ency__card-main">
                        {item.hints?.length ? (
                          <Tooltip
                            placement="top"
                            overlayClassName="ency__tooltip"
                            title={item.hints.map((h, i) => (
                              <div key={i} className="ency__tooltip-line">
                                {h}
                              </div>
                            ))}
                          >
                            <div className="ency__card-name ency__card-name--hint">
                              {item.name}
                              <span className="ency__hint-badge">?</span>
                            </div>
                          </Tooltip>
                        ) : (
                          <div className="ency__card-name">{item.name}</div>
                        )}
                        {!item.brief && (
                          <div className="ency__card-lines">
                            {item.lines.slice(0, 4).map((line, i) => (
                              <div key={i} className={`ency__line ${line.tier || ''}`}>
                                {line.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <BaseModal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="md"
        title={detail ? `${detail.name}` : ''}
      >
        {detail && (
          <div className="ency__detail">
            <div className="ency__detail-sub">
              {formatMessage({ id: `encyclopedia.category.${detail.category}` })}
              {' · '}
              {detail.subCategory}
            </div>
            {detail.image && !detail.brief && (
              <div className="ency__detail-img">
                <img src={encodeURI(detail.image)} alt={detail.name} />
              </div>
            )}
            <div className="ency__detail-lines">
              {detail.lines.map((line, i) => (
                <div key={i} className={`ency__line ${line.tier || ''}`}>
                  {line.text}
                </div>
              ))}
            </div>
            {detail.hints?.length > 0 && (
              <div className="ency__detail-hints">
                <div className="ency__detail-hints-title">提示</div>
                {detail.hints.map((h, i) => (
                  <div key={i} className="ency__detail-hints-line">
                    {h}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </BaseModal>
    </div>
  )
}

export default observer(EncyclopediaPage)
