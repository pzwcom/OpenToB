# -*- coding: utf-8 -*-
"""爬取调香词缀（https://tlidb.com/cn/Blending_Rituals）

调香秘仪可为任意腰带增加调香词缀，词缀类型固定为：中型天赋 / 核心天赋 / 异香天赋
（页面帮助文字明确说明，另见 tab「调香秘仪-帮助手册」）。
只产出「词缀 + 词缀类型（异香天赋另含描述）」，不下载图片、不爬材料（配方香料）信息。

输出：..\TOB_Frontend\src\assets\json\装备\调香\调香词缀.json
结构（2026-08-11 起）：
  {词缀类型: [...]}，其中：
  - 中型天赋 / 核心天赋：字符串数组 [词缀文本, ...]（效果直接显示在页面上，无额外描述）
  - 异香天赋：对象数组 [{名称, 描述}, ...]（页面正文只显示名称，效果描述藏在
    e.Hyperlink 的 data-bs-title tooltip 中，需额外提取）

DOM 结构（2026-08 抓取确认，改版排查用）：
  div#调香秘仪 (tab-pane)
    └─ div.card.mb-2
       └─ div.collapse.show
          ├─ div.card-body      帮助文字（1.通过调香秘仪...）
          ├─ form               搜索过滤框（数据已全量渲染在 HTML 中，与过滤无关）
          └─ div.row.row-cols-1.row-cols-lg-2.g-2    词缀列表容器（2 列网格）
             └─ div.col（=1 条词缀）
                └─ div.d-flex.border-top.rounded
                   └─ div.flex-grow-1.mx-2.my-1
                      ├─ div.fw-bold.pb-2 > span[data-modifier-id]  词缀文本（内嵌 span.text-mod=数值、<br>）
                      │    └─ 异香天赋卡片：span 内为 <e class="Hyperlink" data-bs-toggle="tooltip"
                      │        data-bs-title='<div class="text-start"><div>名称</div><div>效果描述<br/>...</div></div>'>
                      │        —— 名称显示在页面，效果描述仅存在于 data-bs-title（HTML 实体编码）
                      ├─ div（第 2 个）                             词缀类型行，形如「中型天赋 Lv.0」（当前 Lv 恒为 0）
                      └─ div（第 3 个）                             配方材料（本脚本不采集）
"""
from bs4 import BeautifulSoup
import requests
import re
import time
import html
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, replace_comma_to_br
from tqdm import tqdm

ua = UserAgent()
logClass = '调香词缀模块'
URL = 'https://tlidb.com/cn/Blending_Rituals'
# 词缀类型行正则：如「中型天赋 Lv.0」→ 取「中型天赋」（以"天赋"结尾的中文短语）
TYPE_RE = re.compile(r'([\u4e00-\u9fff]+天赋)')
# 标题计数正则：h5.card-header 形如「调香秘仪 /97」，/N=总词缀数，用于行数校验
HEADER_COUNT_RE = re.compile(r'/(\d+)')


def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，统一走这里。
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


def extract_exotic_desc(affix_span, affix_text, url):
    """从异香天赋卡片的 span[data-modifier-id] 中提取效果描述。

    异香天赋的页面正文只显示名称，效果描述藏在 span 内
    <e class="Hyperlink" data-bs-toggle="tooltip" data-bs-title="..."> 的 data-bs-title 中
    （Bootstrap tooltip，HTML 实体编码，解码后形如：
    '<div class="text-start"><div>名称</div><div>效果描述<br/>第二行描述</div></div>'）。
    描述取第 2 个 div，内部 <br> 转为 ';'（与其它装备脚本一致）。

    若异香天赋卡片缺失该结构（站点改版），抛 RuntimeError 以便及时发现。"""
    hyperlink = affix_span.find('e', class_='Hyperlink', attrs={'data-bs-title': True})
    if hyperlink is None:
        raise RuntimeError(f"站点结构变化: {url} 异香天赋卡片 {affix_text!r} 缺少 e.Hyperlink[data-bs-title]（描述 tooltip）")
    title_html = html.unescape(hyperlink.get('data-bs-title') or '')
    inner = BeautifulSoup(title_html, 'lxml')
    # lxml 解析字符串片段时 find_all(recursive=False) 会在 soup 根（html 层）查找而返回 0，
    # 因此先取语义化容器 div.text-start，再取其直接子 div
    container = inner.find('div', class_='text-start')
    if container is None:
        raise RuntimeError(f"站点结构变化: {url} 异香天赋卡片 {affix_text!r} 的 data-bs-title 内缺少 div.text-start 容器")
    divs = container.find_all('div', recursive=False)
    if len(divs) < 2:
        raise RuntimeError(f"站点结构变化: {url} 异香天赋卡片 {affix_text!r} 的 data-bs-title 内 div 数量为 {len(divs)}，期望至少 2（名称/描述）")
    # 第 1 个 div 应为名称，与页面显示的词缀文本一致（防错位）
    title_name = remove_all_spaces(divs[0].get_text(strip=True))
    if title_name != affix_text:
        raise RuntimeError(f"站点结构变化: {url} 异香天赋卡片 data-bs-title 内名称 {title_name!r} 与页面文本 {affix_text!r} 不一致")
    desc_div = divs[1]
    replace_comma_to_br(desc_div)  # 描述内 <br> → ';'
    return remove_all_spaces(desc_div.get_text(strip=True))


def parse_entry(col_div, url):
    """解析 1 条调香词缀卡片：返回 (词缀文本, 词缀类型, 异香描述或 None)。
    词缀文本取 span[data-modifier-id]（<br> 已由调用方转 ; 后 remove_all_spaces）；
    词缀类型取 flex-grow-1 容器内第 2 个 div（第 1 个=词缀、第 2 个=类型、第 3 个=材料）；
    异香描述仅当类型为「异香天赋」时从 data-bs-title 提取，其余类型为 None。"""
    grow = col_div.find('div', class_='flex-grow-1 mx-2 my-1')
    if grow is None:
        raise RuntimeError(f"站点结构变化: {url} 词缀卡片缺少描述容器(flex-grow-1 mx-2 my-1)")
    affix_span = grow.find('span', attrs={'data-modifier-id': True})
    if affix_span is None:
        raise RuntimeError(f"站点结构变化: {url} 词缀卡片缺少 span[data-modifier-id]")
    divs = grow.find_all('div', recursive=False)
    if len(divs) < 2:
        raise RuntimeError(f"站点结构变化: {url} 词缀卡片描述容器内 div 数量为 {len(divs)}，期望至少 2（词缀/类型）")
    replace_comma_to_br(affix_span)  # 词缀内 <br> → ';'（与其它装备脚本一致）
    affix_text = remove_all_spaces(affix_span.get_text(strip=True))
    type_line = divs[1].get_text(strip=True)
    m = TYPE_RE.search(type_line)
    if m is None:
        raise RuntimeError(f"站点结构变化: {url} 无法从类型行 {type_line!r} 提取词缀类型（期望如'中型天赋 Lv.0'）")
    affix_type = m.group(1)
    desc = extract_exotic_desc(affix_span, affix_text, url) if affix_type == '异香天赋' else None
    return affix_text, affix_type, desc


def crawl_blending_rituals():
    """抓取调香词缀，输出 {词缀类型: [词缀文本, ...]}。"""
    response = request_page(URL)
    soup = BeautifulSoup(response.text, 'lxml')

    # 1. 语义化定位词缀 tab：div#调香秘仪（替代 tbody/table 下标，改版加表不错位）
    pane = soup.find('div', {'id': '调香秘仪'})
    if pane is None:
        raise RuntimeError(f"站点结构变化: {URL} 找不到 tab 容器 div#调香秘仪")

    # 2. 标题计数校验：h5.card-header「调香秘仪 /97」→ /N
    header_count = None
    for header in pane.find_all('h5', class_='card-header'):
        m = HEADER_COUNT_RE.search(header.get_text(strip=True))
        if m:
            header_count = int(m.group(1))
            break
    if header_count is None:
        raise RuntimeError(f"站点结构变化: {URL} 的 h5.card-header 中找不到 '/N' 计数（形如'调香秘仪 /97'）")

    # 3. 词缀列表容器：collapse 内唯一的 row（row-cols-lg-2 网格）
    affix_row = pane.find('div', class_='row row-cols-1 row-cols-lg-2 g-2')
    if affix_row is None:
        raise RuntimeError(f"站点结构变化: {URL} 找不到词缀列表容器(row row-cols-1 row-cols-lg-2 g-2)")
    cols = affix_row.find_all('div', class_='col', recursive=False)
    if len(cols) != header_count:
        raise RuntimeError(f"站点结构变化: {URL} 词缀卡片数 {len(cols)} 与标题 /{header_count} 不一致，页面可能未完整渲染")

    # 4. 逐条解析并按类型归组（保持页面首次出现顺序）
    result = {}
    for col in tqdm(cols, desc='调香词缀'):
        affix_text, affix_type, desc = parse_entry(col, URL)
        # 异香天赋只有名称，效果描述藏在 tooltip 中 → 组装为 {名称, 描述} 对象；
        # 中型/核心天赋效果直接显示，保持字符串数组不变
        if affix_type == '异香天赋':
            entry = {'名称': affix_text, '描述': desc}
        else:
            entry = affix_text
        result.setdefault(affix_type, []).append(entry)

    total = sum(len(v) for v in result.values())
    print(f'调香词缀抓取完成：{len(result)} 个类型，共 {total} 条词缀（标题声称 {header_count}）')
    for t, v in result.items():
        if t == '异香天赋':
            empty_desc = [e['名称'] for e in v if not e.get('描述')]
            print(f'  {t}: {len(v)} 条（描述非空 {len(v) - len(empty_desc)}/{len(v)}'
                  + (f'，缺描述: {empty_desc}' if empty_desc else '') + '）')
        else:
            print(f'  {t}: {len(v)} 条')
    return result


if __name__ == '__main__':
    BlendingRitualsJson = crawl_blending_rituals()
    save_json(BlendingRitualsJson, r'..\TOB_Frontend\src\assets\json\装备\调香\调香词缀.json')
    print(r'已保存: ..\TOB_Frontend\src\assets\json\装备\调香\调香词缀.json')
