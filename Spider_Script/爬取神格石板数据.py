# -*- coding: utf-8 -*-
"""爬取神格石板（https://tlidb.com/cn/Divinity_Slate）

页面结构（2026-08 抓取确认，改版排查用）：
div#Divinity_Slate 页内有多个 tab-pane（fade），本次只处理 4 个：
  ├─ div#非传奇神格石板（tab-pane）         非传奇石板词缀池（1163 条）
  ├─ div#传奇神格石板（tab-pane）           传奇石板天赋词缀池（163 条）
  ├─ div#Item（tab-pane）                   非传奇石板外观（36 张图，无词缀）
  └─ div#传奇装备（tab-pane）               传奇石板本体（7 块，图片+词缀）

词缀面板（#非传奇神格石板 / #传奇神格石板）共用卡片结构：
  div.card.mb-2 > div.collapse.show > div.row.row-cols-1.row-cols-lg-3.g-2
  └─ div.col ×N
     └─ div.d-flex.border-top.rounded
        ├─ div.flex-shrink-0 > img[src]             天赋图标（冥王/部分新神为空白 src2）
        └─ div.flex-grow-1.mx-2.my-1
           ├─ div.d-flex.justify-content-between    头部行
           │  ├─ span[data-id]                     天赋类型（小型/中型/传奇中型/小型冥王天赋点…）或命名天赋名
           │  └─ span > a[href]                    天赋来源（神/次级职业，如 新神/勇者；冥王→Nether_King）
           └─ 词缀文本：span.text-mod 数值 + e.Hyperlink[data-bs-title] 提示 + br（→';'）
              （非传奇面板尾部常带「（神格生效上限：N）」）

Item 面板（#Item）：同上容器，div.flex-grow-1 > a[href] 为石板名（6 神 × 6 种外观同名），
  图片在 div.flex-shrink-0 > img[src]，alt 为图标名（如 UITalantNGZ10IconAgi112）。

传奇装备面板（#传奇装备）：div.col > div.d-flex.border-top.rounded
  ├─ div.flex-shrink-0 > a[href] > img[src]        石板图（CDN URL）
  └─ div.flex-grow-1.mx-2.my-1
     ├─ a[href]                                    名称（如 星星蛾火）
     ├─ br + 需求等级 N                            需求等级
     ├─ hr
     └─ div.tierParent                             词缀行
        └─ div ×K：span.tier.tier1（空着色条）+ 词缀文本（含 e.Hyperlink 提示、
           及「<小型天赋>」这类槽位占位文本）

主天赋→次天赋 层级：主页（https://tlidb.com/cn）的天赋容器 card.card-header（主天赋）
  内 a[href]（次天赋）即为映射来源；新神/冥王未出现在主页，回退为主天赋=来源自身。

输出（相对路径，CWD 必须在 Spider_Script/ 下执行）：
  1) assets/json/装备/神格石板/非传奇神格石板词缀.json
     {主天赋:{次天赋:[{天赋类型,天赋来源,天赋词缀,天赋提示:{}}]}}
  2) assets/json/装备/神格石板/传奇神格石板天赋词缀.json（同 1 结构，传奇面板 163 条）
  3) assets/json/装备/神格石板/非传奇神格石板图片位置.json
     {石板名:[{图标,图片地址},…]}（Item 面板 36 张石板外观图）
  4) assets/json/装备/神格石板/传奇神格石板词缀.json
     {名称:{名称,等级需求,词缀[],提示:{},图片地址}}
  5) assets/json/装备/神格石板/传奇神格石板图片位置.json
     {名称:图片地址}（传奇装备面板 7 块）
  图片：public/图片/装备/神格石板/非传奇神格石板/*.webp、传奇神格石板/*.webp
"""
from bs4 import BeautifulSoup
import requests
import re
import os
import time
import html
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, replace_comma_to_br, download_pic_by_fakeuseragent
from tqdm import tqdm

ua = UserAgent()
logClass = '神格石板模块'
LIST_URL = 'https://tlidb.com/cn/Divinity_Slate'
HOME_URL = 'https://tlidb.com/cn'

# 记录数下界保护（当前站点数量：1163/163/36/7，改版增减仅作下界兜底）
NON_LEGENDARY_MIN = 900
LEGENDARY_AFFIX_MIN = 100
ITEM_SLATE_MIN = 30
LEGENDARY_ITEM_MIN = 5

JSON_DIR = r'..\TOB_Frontend\src\assets\json\装备\神格石板'
NON_LEGENDARY_PIC_DIR = r'..\TOB_Frontend\public\图片\装备\神格石板\非传奇神格石板'
LEGENDARY_PIC_DIR = r'..\TOB_Frontend\public\图片\装备\神格石板\传奇神格石板'


def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求（3s/6s/12s），脚本内统一走这里。"""
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
            time.sleep(3 * (2 ** attempt))
    raise last_error


def safe_filename(name):
    """Windows 文件名非法字符替换为 _（全角标点如 ：（）不受影响）"""
    return re.sub(r'[\\/:*?"<>|]', '_', name)


def extract_affix_desc(affix_elem, url):
    """词缀 <e class="Hyperlink" data-bs-title="..."> 的 tooltip 描述。

    data-bs-title（HTML 实体编码）解码后为
    '<div class="text-start"><div>词缀/术语名</div><div>效果描述<br/>第二行</div></div>'。
    描述取第 2 个 div，内部 <br> → ';'。结构异常时回退为整个 tooltip 的纯文本。"""
    title = affix_elem.get('data-bs-title')
    if not title:
        raise RuntimeError(f"站点结构变化: {url} 词缀 {remove_all_spaces(affix_elem.get_text(strip=True))!r} 缺少 data-bs-title")
    title_html = html.unescape(title)
    inner = BeautifulSoup(title_html, 'lxml')
    container = inner.find('div', class_='text-start')
    if container is None:
        return remove_all_spaces(inner.get_text(strip=True))
    divs = container.find_all('div', recursive=False)
    if len(divs) < 2:
        return remove_all_spaces(container.get_text(strip=True))
    desc_div = divs[1]
    replace_comma_to_br(desc_div)  # 描述内 <br> → ';'
    return remove_all_spaces(desc_div.get_text(strip=True))


def parse_affix_card(col_div, url):
    """解析 非传奇/传奇 词缀面板 1 张卡片。

    返回 (天赋类型, 天赋来源, 天赋词缀, 天赋提示dict)。
    天赋类型 = span[data-id]（类型或命名天赋名）；天赋来源 = a[href] 文本（神/次级职业）；
    天赋词缀 = 头部行以外文本（<br>→';'，含「（神格生效上限：N）」）；
    天赋提示 = {词缀可见文本: tooltip 描述}。"""
    d_flex = col_div.find('div', class_='d-flex', recursive=False)
    if d_flex is None:
        raise RuntimeError(f"站点结构变化: {url} 卡片内找不到 div.d-flex")
    grow = d_flex.find('div', class_='flex-grow-1 mx-2 my-1', recursive=False)
    if grow is None:
        raise RuntimeError(f"站点结构变化: {url} 卡片内找不到 div.flex-grow-1.mx-2.my-1")
    header = grow.find('div', class_='d-flex justify-content-between', recursive=False)
    if header is None:
        raise RuntimeError(f"站点结构变化: {url} 卡片内找不到头部行 div.d-flex.justify-content-between")
    type_span = header.find('span', attrs={'data-id': True})
    source_a = header.find('a', href=True)
    if type_span is None:
        raise RuntimeError(f"站点结构变化: {url} 卡片头部行缺少 span[data-id]")
    affix_type = remove_all_spaces(type_span.get_text(strip=True))
    # 部分核心天赋（data-id 8000xxxx，征战之神祝福类）无来源链接（<span></span> 空），
    # 天赋来源记为 ''，由调用处归入「无来源」主天赋分组
    affix_source = remove_all_spaces(source_a.get_text(strip=True)) if source_a else ''
    # 词缀文本：<br> → ';'，再去掉头部行取剩余文本
    replace_comma_to_br(grow)
    header.decompose()
    affix_text = remove_all_spaces(grow.get_text(strip=True))
    # 提示：头部行内也有 e.Hyperlink（如来源行）？不取，仅词缀区的 e 才算提示。
    # 注意：此时 header 已 decompose，grow 里只剩词缀区的 e.Hyperlink。
    tips = {}
    for e in grow.find_all('e', class_='Hyperlink', attrs={'data-bs-title': True}):
        e_text = remove_all_spaces(e.get_text(strip=True))
        if not e_text:
            continue
        tips[e_text] = extract_affix_desc(e, url)
    return affix_type, affix_source, affix_text, tips


def build_god_mapping():
    """从主页天赋容器推导 次天赋→主天赋 映射。

    主页每个 主天赋 card.card-header 下的 a[href] 即为次天赋。
    新神/冥王不在主页（无父级），调用处回退为主天赋=来源自身。
    解析失败返回空 dict（调用处退化为扁平分组）。"""
    mapping = {}
    try:
        response = request_page(HOME_URL)
        soup = BeautifulSoup(response.text, 'lxml')
        row = soup.find('div', class_='row row-cols-1 row-cols-lg-2 g-2 mt-2')
        if row is None:
            print(f'[警告] 主页天赋容器未找到，主天赋分组退化为扁平(主天赋=来源): {HOME_URL}')
            return mapping
        for col in row.find_all('div', class_='col', recursive=False):
            card = col.find('div', class_='card')
            if card is None:
                continue
            header = card.find('div', class_='card-header')
            main_god = remove_all_spaces(header.get_text(strip=True)) if header else ''
            if not main_god:
                continue
            for a in card.find_all('a', href=True):
                sub_god = remove_all_spaces(a.get_text(strip=True))
                if sub_god:
                    mapping[sub_god] = main_god
    except Exception as e:
        print(f'[警告] 主页主天赋映射获取失败({e})，主天赋分组退化为扁平(主天赋=来源)')
    return mapping


def crawl_divinity_slate():
    """主流程：非传奇词缀 / 传奇天赋词缀 / Item 石板图 / 传奇装备(图+词缀)"""
    response = request_page(LIST_URL)
    soup = BeautifulSoup(response.text, 'lxml')

    # 0. 主天赋→次天赋 映射（主页推导，失败退化为扁平）
    god_mapping = build_god_mapping()
    print(f'主天赋映射（次天赋→主天赋）: {len(god_mapping)} 组')
    if god_mapping:
        print(f'  样本: {list(god_mapping.items())[:5]}')

    # ============ 1. 非传奇神格石板词缀（#非传奇神格石板，1163 条） ============
    non_legendary_json = {}
    non_pane = soup.find('div', id='非传奇神格石板')
    if non_pane is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 找不到 tab 容器 div#非传奇神格石板")
    non_card = non_pane.find('div', class_='card mb-2')
    if non_card is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 非传奇面板内找不到 card.mb-2")
    non_grid = non_card.find('div', class_='row')
    non_cols = non_grid.find_all('div', class_='col') if non_grid else []
    if len(non_cols) < NON_LEGENDARY_MIN:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 非传奇面板词缀卡片数 {len(non_cols)} < {NON_LEGENDARY_MIN}，页面可能未完整渲染")
    for col in tqdm(non_cols, desc='非传奇神格石板词缀'):
        affix_type, affix_source, affix_text, tips = parse_affix_card(col, LIST_URL)
        if affix_source:
            main_god = god_mapping.get(affix_source, affix_source)
            sub_god = affix_source
        else:  # 无来源核心天赋：归入「无来源」分组，次天赋用天赋名
            main_god, sub_god = '无来源', affix_type
        entry = {"天赋类型": affix_type, "天赋来源": affix_source,
                 "天赋词缀": affix_text, "天赋提示": tips}
        non_legendary_json.setdefault(main_god, {}).setdefault(sub_god, []).append(entry)
    print(f'非传奇神格石板词缀: {sum(len(v) for v in non_legendary_json.values())} 条，主天赋 {len(non_legendary_json)} 组')

    # ============ 2. 传奇神格石板天赋词缀（#传奇神格石板，163 条） ============
    legendary_affix_json = {}
    le_affix_pane = soup.find('div', id='传奇神格石板')
    if le_affix_pane is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 找不到 tab 容器 div#传奇神格石板")
    le_affix_card = le_affix_pane.find('div', class_='card mb-2')
    if le_affix_card is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇神格石板面板内找不到 card.mb-2")
    le_affix_grid = le_affix_card.find('div', class_='row')
    le_affix_cols = le_affix_grid.find_all('div', class_='col') if le_affix_grid else []
    if len(le_affix_cols) < LEGENDARY_AFFIX_MIN:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇神格石板天赋卡片数 {len(le_affix_cols)} < {LEGENDARY_AFFIX_MIN}，页面可能未完整渲染")
    for col in tqdm(le_affix_cols, desc='传奇神格石板天赋词缀'):
        affix_type, affix_source, affix_text, tips = parse_affix_card(col, LIST_URL)
        if affix_source:
            main_god = god_mapping.get(affix_source, affix_source)
            sub_god = affix_source
        else:  # 无来源核心天赋：归入「无来源」分组，次天赋用天赋名
            main_god, sub_god = '无来源', affix_type
        entry = {"天赋类型": affix_type, "天赋来源": affix_source,
                 "天赋词缀": affix_text, "天赋提示": tips}
        legendary_affix_json.setdefault(main_god, {}).setdefault(sub_god, []).append(entry)
    print(f'传奇神格石板天赋词缀: {sum(len(v) for v in legendary_affix_json.values())} 条，主天赋 {len(legendary_affix_json)} 组')

    # ============ 3. Item 面板：非传奇石板外观图（36 张，只取图片） ============
    slate_pic_json = {}
    item_pane = soup.find('div', id='Item')
    if item_pane is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 找不到 tab 容器 div#Item")
    item_card = item_pane.find('div', class_='card mb-2')
    if item_card is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} Item 面板内找不到 card.mb-2")
    item_grid = item_card.find('div', class_='row')
    item_cols = item_grid.find_all('div', class_='col') if item_grid else []
    if len(item_cols) < ITEM_SLATE_MIN:
        raise RuntimeError(f"站点结构变化: {LIST_URL} Item 面板石板数 {len(item_cols)} < {ITEM_SLATE_MIN}，页面可能未完整渲染")
    used_filenames = set()
    for i, col in enumerate(tqdm(item_cols, desc='Item 石板图片')):
        img = col.find('img')
        if img is None or not img.get('src'):
            raise RuntimeError(f"站点结构变化: {LIST_URL} Item 第{i}张卡片缺少图片(img[src])")
        img_url = img['src']
        grow = col.find('div', class_='flex-grow-1 mx-2 my-1')
        name_a = grow.find('a', href=True) if grow else None
        slate_name = remove_all_spaces(name_a.get_text(strip=True)) if name_a else f'slate_{i}'
        # 文件名：CDN URL 的 basename（同名单石板多张图，URL 唯一），冲突时加序号兜底
        fname = os.path.basename(img_url)
        if not fname:
            fname = f'slate_{i}.webp'
        if fname in used_filenames:
            fname = f'{i}_{fname}'
        used_filenames.add(fname)
        download_pic_by_fakeuseragent(logClass, img_url,
                                      os.path.join(NON_LEGENDARY_PIC_DIR, fname))
        slate_pic_json.setdefault(slate_name, []).append({
            "图标": remove_all_spaces(img.get('alt') or ''),
            "图片地址": f'/图片/装备/神格石板/非传奇神格石板/{fname}',
        })
    print(f'Item 石板图: {len(slate_pic_json)} 个石板名，{sum(len(v) for v in slate_pic_json.values())} 张图')

    # ============ 4. 传奇装备面板：传奇石板本体（7 块，图片+词缀） ============
    legendary_slate_json = {}
    legendary_pic_json = {}
    le_item_pane = soup.find('div', id='传奇装备')
    if le_item_pane is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 找不到 tab 容器 div#传奇装备")
    le_item_card = le_item_pane.find('div', class_='card mb-2')
    if le_item_card is None:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备面板内找不到 card.mb-2")
    le_item_grid = le_item_card.find('div', class_='row')
    le_item_cols = le_item_grid.find_all('div', class_='col') if le_item_grid else []
    if len(le_item_cols) < LEGENDARY_ITEM_MIN:
        raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备面板石板数 {len(le_item_cols)} < {LEGENDARY_ITEM_MIN}，页面可能未完整渲染")
    for col in tqdm(le_item_cols, desc='传奇装备石板'):
        d_flex = col.find('div', class_='d-flex', recursive=False)
        if d_flex is None:
            raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备卡片内找不到 div.d-flex")
        img = d_flex.find('img')
        if img is None or not img.get('src'):
            raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备卡片缺少图片(img[src])")
        img_url = img['src']
        grow = d_flex.find('div', class_='flex-grow-1 mx-2 my-1', recursive=False)
        if grow is None:
            raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备卡片内找不到 div.flex-grow-1.mx-2.my-1")
        name_a = grow.find('a', href=True, recursive=False)
        if name_a is None:
            raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备卡片内找不到 a[href] 名称")
        slate_name = remove_all_spaces(name_a.get_text(strip=True))
        # 需求等级：a 之后、hr 之前的文本（形如「需求等级 1」）
        replace_comma_to_br(grow)
        name_a.decompose()
        tier_parent = grow.find('div', class_='tierParent', recursive=False)
        if tier_parent is None:
            raise RuntimeError(f"站点结构变化: {LIST_URL} 传奇装备 {slate_name!r} 找不到 div.tierParent")
        hr_tag = grow.find('hr')
        if hr_tag:
            hr_tag.decompose()
        tier_parent.extract()  # 先摘出词缀行，剩余文本即需求等级
        level_text = remove_all_spaces(grow.get_text(strip=True)).strip(';')
        level_match = re.search(r'\d+', level_text)
        level_req = level_match.group(0) if level_match else level_text
        # 词缀与提示：tierParent 内每行一个 div
        affixes = []
        tips = {}
        for affix_div in tier_parent.find_all('div', recursive=False):
            for e in affix_div.find_all('e', class_='Hyperlink', attrs={'data-bs-title': True}):
                e_text = remove_all_spaces(e.get_text(strip=True))
                if e_text:
                    tips[e_text] = extract_affix_desc(e, LIST_URL)
            affix_text = remove_all_spaces(affix_div.get_text(strip=True))
            if affix_text:
                affixes.append(affix_text)
        # 下载图片并记录地址
        pic_file = safe_filename(slate_name) + '.webp'
        download_pic_by_fakeuseragent(logClass, img_url,
                                      os.path.join(LEGENDARY_PIC_DIR, pic_file))
        pic_path = f'/图片/装备/神格石板/传奇神格石板/{pic_file}'
        legendary_slate_json[slate_name] = {
            "名称": slate_name,
            "等级需求": level_req,
            "词缀": affixes,
            "提示": tips,
            "图片地址": pic_path,
        }
        legendary_pic_json[slate_name] = pic_path
    print(f'传奇装备石板: {len(legendary_slate_json)} 块')

    return non_legendary_json, legendary_affix_json, slate_pic_json, legendary_slate_json, legendary_pic_json


if __name__ == '__main__':
    non_legendary_json, legendary_affix_json, slate_pic_json, legendary_slate_json, legendary_pic_json = crawl_divinity_slate()

    save_json(non_legendary_json, os.path.join(JSON_DIR, '非传奇神格石板词缀.json'))
    save_json(legendary_affix_json, os.path.join(JSON_DIR, '传奇神格石板天赋词缀.json'))
    save_json(slate_pic_json, os.path.join(JSON_DIR, '非传奇神格石板图片位置.json'))
    save_json(legendary_slate_json, os.path.join(JSON_DIR, '传奇神格石板词缀.json'))
    save_json(legendary_pic_json, os.path.join(JSON_DIR, '传奇神格石板图片位置.json'))

    print('已保存: 非传奇神格石板词缀.json / 传奇神格石板天赋词缀.json / 非传奇神格石板图片位置.json')
    print('已保存: 传奇神格石板词缀.json / 传奇神格石板图片位置.json')
