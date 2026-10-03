# -*- coding: utf-8 -*-
"""爬取模组化技能（https://tlidb.com/cn/Modularization_Skill）

模组化技能是召唤系技能的一种：每个模组（如「模组：哥布林长老」）召唤一个召唤物，
可镶嵌共享词缀池（程式/协议，共 27 条）强化召唤物。

页面结构（2026-08 抓取确认，改版排查用）：
列表页 div#Item（tab-pane）
  └─ div.card.mb-2
     └─ div.collapse.show
        └─ div.row.row-cols-1.row-cols-lg-3.g-2    技能网格容器
           └─ div.col ×54（= 18 个唯一模块 × 3 次重复；第 3 次出现的卡片
                          额外带 27 条共享词缀池，其余只带基本信息）
              └─ div.d-flex.border-top.rounded
                 ├─ div.flex-shrink-0 > img[src]              技能图标（CDN URL）
                 └─ div.flex-grow-1.mx-2.my-1
                    ├─ a[href]                                模块名（如「模组：哥布林长老」）
                    ├─ div（第 1 个）                          召唤物技能行（内嵌 <a> 技能名）
                    ├─ div（第 2 个，空）
                    ├─ div.explicitMod[data-src=detailMods]   主词缀（召唤描述 + (Lv1:2)... 等级缩放）
                    └─（仅第 3 次出现）27 × div.explicitMod
                       └─ e.Hyperlink[data-bs-title]          词缀名 + tooltip 描述（同调香词缀结构）

详情页（href 如 Module%3A_Goblin_Priest）：
  div.tab-pane.fade.show.active（主 pane，另有 cache-1/cache-2 副本）
  └─ div.row.row-cols-1.row-cols-lg-3.g-2 > div.card.ui_item.popupItem
     ├─ div.item_ver                                  赛季（如 SS13赛季）
     ├─ div.text-center.icon > img + div.level        图标 + 等级上限
     ├─ div.banner.bannerskill > span.tag ×N          标签（法术/召唤/持续/冰冷/火焰/智械）
     └─ div.px-3.pt-1.pb-3
        ├─ div.d-flex.justify-content-center ×4       属性行（主属性：/魔力消耗/施法速度/冷却时间）
        └─ div.explicitMod[data-src=detailMods]       主词缀（与列表页一致）
  └─ div.card.mb-2（成长 /40）> table                 等级表（thead: level | 列名；tbody 40 行）

输出：
  1) ..\TOB_Frontend\src\assets\json\技能\模组化技能词缀.json
     {模块名: {名称, 赛季, 标签[], 属性{}, 召唤物技能[], 介绍, 等级词缀[], 词缀[], 图片地址}}
     - 词缀: 27 条共享词缀名（引用模组化技能词缀池.json 的描述）
  2) ..\TOB_Frontend\src\assets\json\技能\模组化技能词缀池.json
     {词缀名: {名称, 描述}}（27 条共享词缀池，tooltip 描述，<br> 转 ';'）
  3) 图片: ..\TOB_Frontend\public\图片\技能\模组化技能\{模块名}.webp
"""
from bs4 import BeautifulSoup
import requests
import re
import time
import html
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, replace_comma_to_br, download_pic_by_fakeuseragent
from tqdm import tqdm

ua = UserAgent()
logClass = '模组化技能模块'
SKILL_CATEGORY = '模组化技能'  # public/图片/技能/ 下的子目录名
LIST_URL = 'https://tlidb.com/cn/Modularization_Skill'
# 词缀池最少条数（共享词缀池 27 条：10 程式 + 17 协议），改版可能增减，仅作下界保护
AFFIX_POOL_MIN = 20
# 等级表行数（40 级成长表），仅作下界保护
LEVEL_TABLE_MIN = 30


def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，脚本内所有 requests.get 统一走这里。
    重试间隔 3s/6s/12s 递增，重试耗尽仍失败则抛异常。"""
    last_error = None
    for attempt in range(max_retry):
        headers = {"user-agent": ua.random}
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response
            last_error = RuntimeError(f"HTTP {response.status_code} for {url}")
        except Exception as e:
            last_error = e
        if attempt < max_retry - 1:
            time.sleep(3 * (2 ** attempt))  # 指数退避：3s、6s、12s
    raise last_error


def safe_filename(name):
    """Windows 文件名非法字符替换为 _（全角标点如 ：（）不受影响）"""
    return re.sub(r'[\\/:*?"<>|]', '_', name)


def parse_main_desc(main_div, url):
    """主词缀 div.explicitMod[data-src=detailMods]：
    内部 <br> → ';'，<span class="text-mod"> 数值与 <small class="description">(Lv1:2)...
    等级缩放保留在文本中，e.Hyperlink 只取链接文本（tooltip 描述不展开）。
    返回去空白后的整段文本。"""
    if main_div is None:
        raise RuntimeError(f"站点结构变化: {url} 找不到主词缀 div.explicitMod[data-src=detailMods]")
    replace_comma_to_br(main_div)
    return remove_all_spaces(main_div.get_text(strip=True))


def extract_affix_desc(affix_elem, affix_text, url):
    """从词缀 <e class="Hyperlink" data-bs-title="..."> 提取效果描述。

    与调香词缀的异香天赋同构：data-bs-title（HTML 实体编码）解码后为
    '<div class="text-start"><div>词缀名</div><div>效果描述<br/>第二行</div></div>'。
    描述取第 2 个 div，内部 <br> → ';'。第 1 个 div 名称需与页面显示词缀名一致（防错位）。"""
    title = affix_elem.get('data-bs-title')
    if not title:
        raise RuntimeError(f"站点结构变化: {url} 词缀 {affix_text!r} 缺少 data-bs-title（描述 tooltip）")
    title_html = html.unescape(title)
    inner = BeautifulSoup(title_html, 'lxml')
    container = inner.find('div', class_='text-start')
    if container is None:
        raise RuntimeError(f"站点结构变化: {url} 词缀 {affix_text!r} 的 data-bs-title 内缺少 div.text-start 容器")
    divs = container.find_all('div', recursive=False)
    if len(divs) < 2:
        raise RuntimeError(f"站点结构变化: {url} 词缀 {affix_text!r} 的 data-bs-title 内 div 数量为 {len(divs)}，期望至少 2（名称/描述）")
    title_name = remove_all_spaces(divs[0].get_text(strip=True))
    if title_name != affix_text:
        raise RuntimeError(f"站点结构变化: {url} 词缀 data-bs-title 内名称 {title_name!r} 与页面文本 {affix_text!r} 不一致")
    desc_div = divs[1]
    replace_comma_to_br(desc_div)  # 描述内 <br> → ';'
    return remove_all_spaces(desc_div.get_text(strip=True))


def parse_list_card(col_div, url):
    """解析列表页 1 张技能卡片：返回 dict（名称/href/图标/召唤物技能/主词缀/词缀条目）。
    词缀条目取卡片内全部 e.Hyperlink[data-bs-title]（第 3 次出现的卡片才有 27 条，其余为空）。
    必须用下标注释：grow 的直接子 div 第 1 个 = 召唤物技能行。"""
    d_flex = col_div.find('div', class_='d-flex', recursive=False)
    if d_flex is None:
        raise RuntimeError(f"站点结构变化: {url} 技能卡片内找不到 div.d-flex")
    img = d_flex.find('img')
    icon_url = img['src'] if img else ''
    grow = d_flex.find('div', class_='flex-grow-1 mx-2 my-1', recursive=False)
    if grow is None:
        raise RuntimeError(f"站点结构变化: {url} 技能卡片内找不到 div.flex-grow-1.mx-2.my-1")
    name_a = grow.find('a', href=True, recursive=False)
    if name_a is None:
        raise RuntimeError(f"站点结构变化: {url} 技能卡片内找不到 a[href] 模块名")
    name = remove_all_spaces(name_a.get_text(strip=True))
    href = name_a['href']
    # 召唤物技能行：grow 直接子 div 第 1 个（形如「召唤物技能: <a>霜爪</a>, <a>炎鸟</a>」）
    grow_divs = grow.find_all('div', recursive=False)
    if len(grow_divs) < 3:
        raise RuntimeError(f"站点结构变化: {url} 技能卡片 {name!r} 内直接子 div 数 {len(grow_divs)}，期望至少 3（召唤物技能/空/主词缀）")
    summon_a = grow_divs[0].find_all('a')
    summon_skills = [remove_all_spaces(a.get_text(strip=True)) for a in summon_a if a.get_text(strip=True)]
    # 主词缀：data-src=detailMods 的 explicitMod
    main_div = grow.find('div', attrs={'data-src': 'detailMods'})
    main_desc = parse_main_desc(main_div, url)
    # 词缀池条目：仅取词缀池 div.explicitMod（data-src != detailMods）内的 e.Hyperlink。
    # 主词缀 detailMods 里的 e.Hyperlink（统御值/穿透/邪祟等术语）不属于词缀池，跳过。
    affix_items = []
    for em in grow.find_all('div', class_='explicitMod'):
        if em.get('data-src') == 'detailMods':
            continue
        for e in em.find_all('e', class_='Hyperlink', attrs={'data-bs-title': True}):
            affix_text = remove_all_spaces(e.get_text(strip=True))
            if not affix_text:
                continue
            desc = extract_affix_desc(e, affix_text, url)
            affix_items.append((affix_text, desc))
    return {'名称': name, 'href': href, '图标': icon_url,
            '召唤物技能': summon_skills, '介绍': main_desc, '词缀条目': affix_items}


def parse_detail_page(detail_url):
    """解析详情页：赛季、标签、属性、等级表。只取主 pane（tab-pane fade show active），
    跳过 cache-1/cache-2 副本。"""
    response = request_page(detail_url)
    soup = BeautifulSoup(response.text, 'lxml')
    pane = soup.find('div', class_='tab-pane fade show active')
    if pane is None:
        raise RuntimeError(f"站点结构变化: {detail_url} 找不到主 pane(tab-pane fade show active)")
    h1 = pane.find('h1')
    if h1 is None:
        raise RuntimeError(f"站点结构变化: {detail_url} 找不到 h1 技能名")
    card = pane.find('div', class_='card ui_item popupItem')
    if card is None:
        raise RuntimeError(f"站点结构变化: {detail_url} 找不到 card ui_item popupItem")
    # 赛季
    item_ver = card.find('div', class_='item_ver')
    season = remove_all_spaces(item_ver.get_text(strip=True)) if item_ver else ''
    # 标签
    banner = card.find('div', class_='banner')
    tags = []
    if banner:
        tags = [remove_all_spaces(s.get_text(strip=True)) for s in banner.find_all('span', class_='tag')]
    # 属性 4 行：d-flex.justify-content-center（主属性：/魔力消耗/施法速度/冷却时间）
    props = {}
    for row in card.find_all('div', class_='d-flex justify-content-center'):
        parts = [p for p in row.get_text('|', strip=True).split('|') if p]
        if not parts:
            continue
        key = parts[0].rstrip('：:')
        if key:
            props[key] = ''.join(parts[1:])
    # 等级表：主 pane 内 card.mb-2 > table（成长 /40）
    level_rows = []
    grow_card = pane.find('div', class_='card mb-2')
    if grow_card is not None:
        table = grow_card.find('table')
        if table is not None:
            thead = table.find('thead')
            tbody = table.find('tbody')
            if thead is not None and tbody is not None:
                ths = [remove_all_spaces(th.get_text(strip=True)) for th in thead.find_all('th')]
                for tr in tbody.find_all('tr'):
                    tds = [remove_all_spaces(td.get_text(strip=True)) for td in tr.find_all('td')]
                    level_rows.append(dict(zip(ths, tds)))
    if level_rows and len(level_rows) < LEVEL_TABLE_MIN:
        raise RuntimeError(f"站点结构变化: {detail_url} 等级表行数 {len(level_rows)} < {LEVEL_TABLE_MIN}，页面可能未完整渲染")
    return {'赛季': season, '标签': tags, '属性': props, '等级词缀': level_rows}


def crawl_modularization_skills():
    """抓取模组化技能：列表页去重 18 个唯一模块（54 卡片 / 3 次重复），
    词缀池取出现次数最多的那次卡片（第 3 次，27 条）；每个模块再抓详情页补充字段。"""
    response = request_page(LIST_URL)
    soup = BeautifulSoup(response.text, 'lxml')

    # 1. 语义化定位技能网格容器
    item_pane = soup.find('div', {'id': 'Item'})
    if item_pane is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 找不到 tab 容器 div#Item")
    grid = None
    for row in item_pane.find_all('div', class_='row'):
        if 'row-cols-lg-3' in (row.get('class') or []):
            grid = row
            break
    if grid is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 找不到技能网格容器(row row-cols-1 row-cols-lg-3 g-2)")
    cols = grid.find_all('div', class_='col', recursive=False)
    if not cols:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 技能网格容器内没有卡片(div.col)")

    # 2. 逐卡片解析并按 href 去重合并（同一模块出现 3 次，词缀池取条目最多那次）
    modules = {}
    for col in tqdm(cols, desc='模组化技能列表'):
        info = parse_list_card(col, LIST_URL)
        key = info['href']
        if key not in modules:
            modules[key] = info
        else:
            cur = modules[key]
            # 词缀池：保留条目数更多的出现（第 3 次出现 27 条，前两次为空）
            if len(info['词缀条目']) > len(cur['词缀条目']):
                cur['词缀条目'] = info['词缀条目']
            # 主词缀/召唤物技能以非空者为准（各次出现应一致，防某次渲染不完整）
            if not cur['介绍'] and info['介绍']:
                cur['介绍'] = info['介绍']
            if not cur['召唤物技能'] and info['召唤物技能']:
                cur['召唤物技能'] = info['召唤物技能']
    if not modules:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 未解析到任何唯一模块")
    print(f'列表页唯一模块数: {len(modules)}（网格卡片 {len(cols)} 张，每模块出现 {len(cols) / len(modules):.1f} 次）')

    # 3. 词缀池：全局共享 27 条，从任一模块提取（保首次出现顺序）
    affix_pool = {}
    for info in modules.values():
        for name, desc in info['词缀条目']:
            if name not in affix_pool:
                affix_pool[name] = {'名称': name, '描述': desc}
    if len(affix_pool) < AFFIX_POOL_MIN:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 共享词缀池仅 {len(affix_pool)} 条 < {AFFIX_POOL_MIN}，页面可能未渲染词缀")

    # 4. 每个模块抓详情页补充字段 + 下载图标
    result = {}
    for info in tqdm(modules.values(), desc='模组化技能详情'):
        detail_url = f'https://tlidb.com/cn/{info["href"]}'
        detail = parse_detail_page(detail_url)
        name = info['名称']
        entry = {
            '名称': name,
            '赛季': detail['赛季'],
            '标签': detail['标签'],
            '属性': detail['属性'],
            '召唤物技能': info['召唤物技能'],
            '介绍': info['介绍'],
            '等级词缀': detail['等级词缀'],
            # 词缀池为全局共享，每模块记录词缀名列表（描述见模组化技能词缀池.json）
            '词缀': [n for n, _ in info['词缀条目']],
        }
        # 下载图标并记录图片地址（public 相对路径，前端直接引用）
        if info['图标']:
            pic_file = safe_filename(name) + '.webp'
            download_pic_by_fakeuseragent(logClass, info['图标'],
                                          rf'..\TOB_Frontend\public\图片\技能\{SKILL_CATEGORY}\{pic_file}',
                                          if_cover=False)
            entry['图片地址'] = f'/图片/技能/{SKILL_CATEGORY}/{pic_file}'
        result[name] = entry

    print(f'模组化技能抓取完成：{len(result)} 个模块，共享词缀池 {len(affix_pool)} 条')
    return result, affix_pool


if __name__ == '__main__':
    ModularizationSkillJson, AffixPoolJson = crawl_modularization_skills()
    save_json(ModularizationSkillJson, r'..\TOB_Frontend\src\assets\json\技能\模组化技能词缀.json')
    save_json(AffixPoolJson, r'..\TOB_Frontend\src\assets\json\技能\模组化技能词缀池.json')
    print(r'已保存: ..\TOB_Frontend\src\assets\json\技能\模组化技能词缀.json')
    print(r'已保存: ..\TOB_Frontend\src\assets\json\技能\模组化技能词缀池.json')
