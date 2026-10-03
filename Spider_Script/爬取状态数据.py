# -*- coding: utf-8 -*-
"""爬取《火炬之光：无限》状态说明（控制类状态 + 元素异常状态 + 特殊异常状态）。

数据源：
1. 主来源：https://tlidb.com/cn/Help 帮助手册中的各状态独立页
   （如 /cn/Slow 减速、/cn/Paralysis 瘫痪、/cn/Ailment 异常状态总览、/cn/Ignite 点燃等），
   状态详细说明位于页面第一个 <div class="card-body clearfix"> 内，其中 <RichText> 标签壳需剥离、<br> 转 ';'。
2. 补充来源：https://tlidb.com/cn/Hyperlink 情报页（name/des 两列表格），
   用于补齐无独立页面的状态（如"虚弱"），其简要定义在 des 列。

覆盖范围（对应规格与游戏内 tooltip 定义）：
- 控制类状态（规格 8 个）：冰结、冰封（同一页 冰结和冰封）、瘫痪、击退、虚弱、减速、嘲讽、致盲
- 异常状态（7 项）：异常状态总览、点燃、冰结和冰封、触电、凋零、麻痹、创伤
- 特殊异常状态（4 项，异常状态的进阶版本，Ailment 页有说明）：烧灼、冻僵、致残、腐烂

输出：..\TOB_Frontend\src\assets\json\状态\状态说明.json
    {分组名: {状态名: {名称, 类别, 说明}}}
状态说明以文字为主，状态页说明区域无专属图标，故不下载图片。
"""
from bs4 import BeautifulSoup
import re
import requests
import time
from fake_useragent import UserAgent
from utils import remove_all_spaces, save_json

ua = UserAgent()
logClass = '状态模块'

BASE = 'https://tlidb.com/cn/'


def request_page(url, max_retry=3):
    """带超时与指数退避的页面请求"""
    headers = {"user-agent": ua.random, "referer": "https://tlidb.com/cn/"}
    for attempt in range(max_retry):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                return response
            if response.status_code in (403, 429) and attempt < max_retry - 1:
                time.sleep(3 * (2 ** attempt))
                continue
            response.raise_for_status()
        except requests.RequestException as e:
            if attempt < max_retry - 1:
                time.sleep(3 * (2 ** attempt))
                continue
            raise RuntimeError(f'请求失败: {url} {e}') from e
    raise RuntimeError(f'请求重试耗尽: {url}')


def clean_status_desc(soup):
    """提取状态页说明：取第一个 div.card-body.clearfix，剥离 <RichText> 标签壳、<br> 转 ';'、去全部空白。

    返回说明文本；找不到说明容器时返回 None。
    """
    cb = soup.select_one('div.card-body.clearfix')
    if cb is None:
        return None
    # 剥离 <RichText ...> 标签壳，保留其内部文字（关闭符是 </>，交给下方正则兜底）
    for tag in cb.find_all(re.compile(r'^RichText$', re.I)):
        tag.replace_with(tag.get_text())
    for br in cb.find_all('br'):
        br.replace_with(';')
    txt = cb.get_text('', strip=True)
    txt = re.sub(r'<[^>]*>', '', txt)  # 清理残留的 <> 壳（如 </>）
    return remove_all_spaces(txt)


def fetch_status_desc(slug):
    """抓取单个状态页的详细说明文本。

    说明取页面第一个 div.card-body.clearfix（部分状态页首个 tab 是关联技能/空列表，
    如 Scorch 页首 tab 为"炽热"诅咒技能，但说明容器仍是"烧灼"的说明）。
    返回清洗后的说明文本。
    """
    url = BASE + slug
    soup = BeautifulSoup(request_page(url).text, 'html.parser')
    desc = clean_status_desc(soup)
    if not desc:
        raise RuntimeError(f'状态页 {slug} 未找到说明容器 div.card-body.clearfix，站点结构可能已改版')
    return desc


def fetch_hyperlink_desc(name):
    """从 Hyperlink 情报页表格中取指定名称的简要定义（用于无独立页面的状态，如虚弱）。"""
    soup = BeautifulSoup(request_page(BASE + 'Hyperlink').text, 'html.parser')
    table = soup.find('table')
    if table is None:
        raise RuntimeError('Hyperlink 情报页未找到表格，站点结构可能已改版')
    rows = table.find_all('tr')
    if len(rows) < 2:
        raise RuntimeError(f'Hyperlink 情报页表格行数异常({len(rows)})，站点结构可能已改版')
    for tr in rows:
        tds = tr.find_all('td')
        if len(tds) >= 2 and remove_all_spaces(tds[0].get_text('', strip=True)) == name:
            return remove_all_spaces(tds[1].get_text(' ', strip=True))
    raise RuntimeError(f'Hyperlink 情报页中未找到 {name} 的定义，站点结构可能已改版')


if __name__ == '__main__':
    # ============ 1. 控制类状态（规格 8 个：冰结、冰封、瘫痪、击退、虚弱、减速、嘲讽、致盲） ============
    # 冰结/冰封共用 "冰结和冰封" 页面；虚弱无独立页，说明取自 Hyperlink 情报页
    CONTROL_PAGES = [
        ('Frostbite_and_Freeze', '冰结和冰封'),  # 覆盖 冰结 + 冰封
        ('Paralysis', '瘫痪'),
        ('Knockback', '击退'),
        ('Slow', '减速'),
        ('Taunt', '嘲讽'),
        ('Blind', '致盲'),
    ]
    ControlJson = {}
    for slug, name in CONTROL_PAGES:
        desc = fetch_status_desc(slug)
        ControlJson[name] = {'名称': name, '类别': '控制类状态', '说明': desc}
    # 虚弱：Hyperlink 情报页简述
    WeaknessDesc = fetch_hyperlink_desc('虚弱')
    ControlJson['虚弱'] = {'名称': '虚弱', '类别': '控制类状态', '说明': WeaknessDesc}

    # ============ 2. 异常状态（7 项） ============
    AILMENT_PAGES = [
        ('Ailment', '异常状态'),        # 总览：点燃/冰结/冰封/触电/麻痹/创伤/凋零 的说明与机制
        ('Ignite', '点燃'),
        ('Frostbite_and_Freeze', '冰结和冰封'),
        ('Shock', '触电'),
        ('Wilt', '凋零'),
        ('Numbed', '麻痹'),
        ('Trauma', '创伤'),
    ]
    AilmentJson = {}
    for slug, name in AILMENT_PAGES:
        desc = fetch_status_desc(slug)
        AilmentJson[name] = {'名称': name, '类别': '异常状态', '说明': desc}

    # ============ 3. 特殊异常状态（4 项，Ailment 页定义的进阶异常） ============
    SPECIAL_PAGES = [
        ('Scorch', '烧灼'),
        ('Frosted', '冻僵'),
        ('Maim', '致残'),
        ('Rot', '腐烂'),
    ]
    SpecialJson = {}
    for slug, name in SPECIAL_PAGES:
        desc = fetch_status_desc(slug)
        SpecialJson[name] = {'名称': name, '类别': '特殊异常状态', '说明': desc}

    # ============ 完整性校验 ============
    # 规格要求的 8 个控制类状态：冰结、冰封由 "冰结和冰封" 条目覆盖，其余各对应一个条目（key 校验）
    control_expected = ['冰结', '冰封', '瘫痪', '击退', '虚弱', '减速', '嘲讽', '致盲']
    covered = set()
    for k in ControlJson:
        if k == '冰结和冰封':
            covered.update(['冰结', '冰封'])
        else:
            covered.add(k)
    missing = [s for s in control_expected if s not in covered]
    if missing:
        raise RuntimeError(f'控制类状态缺失覆盖: {missing}，站点结构可能已改版')
    if len(ControlJson) < 6:
        raise RuntimeError(f'控制类状态仅解析到 {len(ControlJson)} 条（预期 6 页 + 虚弱），站点结构可能已改版')
    if len(AilmentJson) < 7:
        raise RuntimeError(f'异常状态仅解析到 {len(AilmentJson)} 条（预期 7），站点结构可能已改版')
    if len(SpecialJson) < 4:
        raise RuntimeError(f'特殊异常状态仅解析到 {len(SpecialJson)} 条（预期 4），站点结构可能已改版')
    for group in (ControlJson, AilmentJson, SpecialJson):
        empty = [k for k, v in group.items() if not v.get('说明')]
        if empty:
            raise RuntimeError(f'以下状态说明为空: {empty}，站点结构可能已改版')

    # ============ 落盘 ============
    StatusJson = {
        '控制类状态': ControlJson,
        '异常状态': AilmentJson,
        '特殊异常状态': SpecialJson,
    }
    save_json(StatusJson, r"..\TOB_Frontend\src\assets\json\状态\状态说明.json")

    print('控制类状态:', list(ControlJson.keys()))
    print('异常状态:', list(AilmentJson.keys()))
    print('特殊异常状态:', list(SpecialJson.keys()))
    print('控制类状态规格 8 项覆盖:', not missing)
    print('完成: ..\\TOB_Frontend\\src\\assets\\json\\状态\\状态说明.json')
