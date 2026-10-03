from bs4 import BeautifulSoup
import requests
import json
import re
import time
from fake_useragent import UserAgent
from utils import save_json,remove_all_spaces,replace_comma_to_br
from tqdm import tqdm
ua = UserAgent()
# 随机选择一个User-Agent
logClass='普通装备模块'

def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，脚本内所有 requests.get 统一走这里。
    重试间隔 3s/6s/12s 递增，重试耗尽仍失败则抛异常（瞬时网络错误不再直接崩溃）。"""
    last_error = None
    for attempt in range(max_retry):
        headers = {"user-agent":ua.random}
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

def find_base_entry_tbody(soup, url):
    """语义化定位基础词缀表：h5.card-header 文本含'基础词缀'的 card 内唯一 table。
    替代旧 find_all('tbody')[1] 下标（页面第 0 个 tbody=词缀总览表，第 1 个=基础词缀表，
    改版加/删表会错位）。找不到时抛明确错误提示站点结构变化。"""
    for header in soup.find_all('h5', class_='card-header'):
        if '基础词缀' in header.get_text():
            card = header.parent  # <div class="card mb-2">
            tables = card.find_all('table')
            if not tables:
                raise RuntimeError(f"站点结构变化: {url} 的'基础词缀'card 内没有 table")
            return tables[0].find('tbody')
    raise RuntimeError(f"站点结构变化: {url} 找不到'基础词缀'标题(h5.card-header)，旧下标 tbody[1] 定位已失效")

def find_craft_tables(soup, url):
    """语义化定位打造前缀/后缀表：h1 文本含'打造'的 tab-pane 内 div.row 下的 col-lg-6，
    按 table 的 caption 文本（'前缀'/'后缀'）区分，替代旧 index==0/else 下标判断。
    校验 col-lg-6 恰好 2 个，否则抛明确错误。"""
    craft_h1 = None
    for h in soup.find_all('h1'):
        if '打造' in h.get_text():
            craft_h1 = h
            break
    if craft_h1 is None:
        raise RuntimeError(f"站点结构变化: {url} 找不到'打造'标题(h1)，打造词缀表定位失效")
    pane = craft_h1.parent
    if pane is None or 'tab-pane' not in (pane.get('class') or []):
        raise RuntimeError(f"站点结构变化: {url} 的'打造'标题不在 tab-pane 内")
    row = pane.find('div', class_='row')
    if row is None:
        raise RuntimeError(f"站点结构变化: {url} 打造 tab-pane 内没有 div.row")
    col6_wrappers = row.find_all('div', class_='col-lg-6')
    if len(col6_wrappers) != 2:
        raise RuntimeError(f"站点结构变化: {url} 打造区块 col-lg-6 数量为 {len(col6_wrappers)}，应为 2（前缀/后缀各 1）")
    tables = {}
    for wrapper in col6_wrappers:
        table = wrapper.find('table')
        if table is None:
            raise RuntimeError(f"站点结构变化: {url} 打造区块 col-lg-6 内没有 table")
        caption = table.find('caption')
        caption_text = caption.get_text(strip=True) if caption else ''
        tables[caption_text] = table
    for entry_class in ('前缀', '后缀'):
        if entry_class not in tables:
            raise RuntimeError(f"站点结构变化: {url} 打造区块缺少 caption='{entry_class}' 的表")
    return tables

def extract_entry_obj(tds, col_map):
    """按 col_map=[(输出键, td列下标), ...] 提取 td 文本并清洗（去空白、<br> 已由调用方转 ;）。
    列数不足时抛明确错误防止静默产出残缺数据；输出键顺序与旧版 JSON 保持一致。"""
    need_cols = max(idx for _, idx in col_map) + 1
    if len(tds) < need_cols:
        raise RuntimeError(f"站点结构变化: 表格列数 {len(tds)} 不足，期望至少 {need_cols} 列({col_map})")
    return {name: remove_all_spaces(tds[idx].text.strip()) for name, idx in col_map}

def extract_tower_series(text):
    """从 div[data-chip] 文本（如 '中阶序列 1|2|6'）提取序列名。
    用正则取'以序列结尾的连续中文'，比旧代码 remove_all_spaces(text)[:4] 更抗改版
    （新增更长/更短的序列名不会截断错位）。"""
    m = re.search(r'([\u4e00-\u9fff]+序列)', remove_all_spaces(text))
    if m is None:
        raise RuntimeError(f"站点结构变化: 无法从 {text!r} 提取序列名（期望如'中阶序列 1|2|6'）")
    return m.group(1)

def crawl_tower_sequence():
    """爬取高塔序列词缀（https://tlidb.com/cn/TOWER_Sequence），输出 {装备类别:[[词缀,系列]]}。
    语义化定位，替代旧爬取高塔词缀.py 的 soup.find('tbody') 裸定位：
      - 容器：h5.card-header 文本含'高塔序列'的 card（card-header 形如 '高塔序列 /408'，/N=总行数，用于行数校验）
      - 词缀：td[0] 内 span[data-modifier-id] 的文本（含 <br> 先由 replace_comma_to_br 转 ;）
      - 系列：td[0] 内 div[data-chip] 文本中的'X序列'
      - 来源：td[1] 文本（当前为单类别，保留逗号分隔兼容多类别）
    输出结构保持与旧版一致：{装备类别: [[词缀, 系列], ...]}。"""
    url = 'https://tlidb.com/cn/TOWER_Sequence'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'lxml')

    # 1. 语义化定位表格容器：card-header 含'高塔序列'的 card（替代旧 find('tbody') 裸定位）
    card = None
    header_count_text = None
    for header in soup.find_all('h5', class_='card-header'):
        header_text = header.get_text(strip=True)
        if '高塔序列' in header_text:
            card = header.parent
            m = re.search(r'/(\d+)', header_text)
            header_count_text = m.group(1) if m else None
            break
    if card is None:
        raise RuntimeError("站点结构变化: TOWER_Sequence 页面找不到'高塔序列'的 h5.card-header")

    table = card.find('table')
    if table is None:
        raise RuntimeError("站点结构变化: TOWER_Sequence 的'高塔序列'card 内没有 table")
    tbody = table.find('tbody')
    if tbody is None:
        raise RuntimeError("站点结构变化: TOWER_Sequence 的'高塔序列'table 内没有 tbody")
    trs = tbody.find_all('tr')

    # 2. 行数保护：card-header 的 '/N' 与 tbody 行数应一致（防 DataTables 半渲染/分页截断）
    if header_count_text is not None and len(trs) != int(header_count_text):
        raise RuntimeError(f"站点结构变化: TOWER_Sequence 表格行数 {len(trs)} 与标题 /{header_count_text} 不一致，页面可能未完整渲染")

    # 3. 逐行提取 [词缀, 系列, [来源...]]
    tower_entry_list = []
    for tr in trs:
        replace_comma_to_br(tr)  # 词缀文本内的 <br> 统一转 ;（与其它装备脚本一致）
        tds = tr.find_all('td')
        if len(tds) < 2:
            raise RuntimeError(f"站点结构变化: TOWER_Sequence 某行 td 数量为 {len(tds)}，期望至少 2 列(Affix/来源)")
        affix_span = tds[0].find('span', attrs={'data-modifier-id': True})
        chip_div = tds[0].find('div', attrs={'data-chip': True})
        if affix_span is None or chip_div is None:
            raise RuntimeError("站点结构变化: TOWER_Sequence 某行 Affix 单元格找不到 span[data-modifier-id] 或 div[data-chip]")
        tower_entry = remove_all_spaces(affix_span.get_text(strip=True))
        xuelie = extract_tower_series(chip_div.get_text(strip=True))
        sources = [s for s in remove_all_spaces(tds[1].get_text(strip=True)).split(',') if s]
        tower_entry_list.append([tower_entry, xuelie, sources])

    # 4. 按装备类别归组（sorted 保证输出顺序确定，方便与旧版本 diff）
    equip_class_list = sorted({src for _, _, sources in tower_entry_list for src in sources})
    res = {equip_class: [] for equip_class in equip_class_list}
    for equip_class in equip_class_list:
        for tower_entry, xuelie, sources in tower_entry_list:
            if equip_class in sources:
                res[equip_class].append([tower_entry, xuelie])
    return res

if __name__ == '__main__':
    with open(r'base_json\装备分类英转中.json', 'r', encoding='utf-8') as f:
        EquipmentsClassEnToChJson = json.load(f)
    with open(r'base_json\装备分类.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    EquipmentsBaseEntryJson={}
    EquipmentModifiedJson={}
    for key in tqdm(list(data.keys())):
        if key in ('英雄追忆','Hero_Memories'):
            continue
        for item in data[key]:
            if item not in EquipmentsClassEnToChJson:
                print(f'[警告] 装备分类英转中.json 缺少 {item} 的映射，跳过该 item（未崩溃）')
                continue
            item_zh = EquipmentsClassEnToChJson[item]
            # 下载基础词缀（h5.card-header 含'基础词缀'的 card 内 table，非 tbody 下标）
            BaseEquipmentEntryUrl = f'https://tlidb.com/cn/{item}#{item_zh}基础词缀'
            response = request_page(BaseEquipmentEntryUrl)
            EquipmentBaseEntrySoup = BeautifulSoup(response.text, 'lxml')
            EquipmentBaseEntryTbody = find_base_entry_tbody(EquipmentBaseEntrySoup, BaseEquipmentEntryUrl)
            EquipmentsBaseEntryJson[item_zh]=[]
            for EquipmentBaseEntryTr in EquipmentBaseEntryTbody.find_all('tr'):
                replace_comma_to_br(EquipmentBaseEntryTr)
                EquipmentBaseEntryTds=EquipmentBaseEntryTr.find_all('td')
                EquipmentBaseEntryObj=extract_entry_obj(EquipmentBaseEntryTds, [('Entry',1),('Tier',0),('Level',2),('Weight',3)])
                EquipmentBaseEntryObj['text']=EquipmentBaseEntryObj['Entry']
                EquipmentsBaseEntryJson[item_zh].append(EquipmentBaseEntryObj)
            # 下载打造词缀（h1 含'打造'的 pane 内 col-lg-6，按 caption 前缀/后缀区分）
            EquipmentModifiedJson[item_zh]={'前缀':[],'后缀':[]}
            EquipmentModifiedUrl = f'https://tlidb.com/cn/{item}#{item_zh}打造'
            response = request_page(EquipmentModifiedUrl)
            EquipmentModifiedSoup = BeautifulSoup(response.text, 'lxml')
            craft_tables = find_craft_tables(EquipmentModifiedSoup, EquipmentModifiedUrl)
            for entry_class in ('前缀', '后缀'):
                EquipmentModifiedTbody = craft_tables[entry_class].find('tbody')
                for EquipmentModifiedTr in EquipmentModifiedTbody.find_all('tr'):
                    replace_comma_to_br(EquipmentModifiedTr)
                    EquipmentModifiedTds=EquipmentModifiedTr.find_all('td')
                    EquipmentModifiedEntryObj=extract_entry_obj(EquipmentModifiedTds, [('Entry',1),('Tier',0),('Level',2),('Weight',3),('Library',4)])
                    EquipmentModifiedJson[item_zh][entry_class].append(EquipmentModifiedEntryObj)

    # 高塔序列（TOWER_Sequence）：整合自原爬取高塔词缀.py，输出结构保持 {装备类别:[[词缀,系列]]}
    print('[高塔序列] 开始抓取 TOWER_Sequence ...')
    TowerSequenceJson = crawl_tower_sequence()
    total = sum(len(v) for v in TowerSequenceJson.values())
    print(f'[高塔序列] 抓取完成：{len(TowerSequenceJson)} 个装备类别，共 {total} 条词缀')
    save_json(TowerSequenceJson, r'..\TOB_Frontend\src\assets\json\装备\高塔序列\高塔序列词缀.json')

    save_json(EquipmentsBaseEntryJson,r'..\TOB_Frontend\src\assets\json\装备\普通装备\基础词缀.json')
    save_json(EquipmentModifiedJson,r'..\TOB_Frontend\src\assets\json\装备\普通装备\打造词缀.json')
