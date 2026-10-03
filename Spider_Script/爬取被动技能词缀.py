# -*- coding: utf-8 -*-
from bs4 import BeautifulSoup
import requests
import re
import time
import copy
from difflib import SequenceMatcher
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, download_pic_by_fakeuseragent
from tqdm import tqdm

ua = UserAgent()
logClass = '被动技能模块'
SKILL_CATEGORY = '被动技能'  # public/图片/技能/ 下的子目录名

# 光环类被动技能没有逐级等级表，详情页只有两个 explicitMod：
#   explicitMod[0] = Simple 模式（1 级数值）
#   explicitMod[1] = Details 模式（20 级数值）
# 逐级数值 = 以 1 级为起点、按 (20级值 - 1级值)/19 等差推导到 40 级。
NUM_TOKEN_RE = re.compile(r'([+-]?)(\d+(?:\.\d+)?(?:/\d+)?)(%?)')


def _clean_ctx(s):
    """取上下文用：去空白与中文标点（保留数字/小数/百分号/加减号）"""
    s = re.sub(r'\s+', '', s)
    return re.sub(r'[，。、；：""''（）()【】\[\]「」『』·…—]', '', s)


def _parse_num(token):
    """'+61%' -> 61.0；'+5/2%' -> 2.5；'319.7' -> 319.7；'-12%' -> -12.0"""
    m = NUM_TOKEN_RE.search(token)
    if not m:
        return None
    sign, num, pct = m.groups()
    if '/' in num:
        a, b = num.split('/')
        v = float(a) / float(b)
    else:
        v = float(num)
    return v if sign != '-' else -v


def _tokens_raw(text):
    """从原始文本提取全部数值 token（含在文本中的起止位置）"""
    res = []
    for m in NUM_TOKEN_RE.finditer(text):
        raw = m.group(0)
        v = _parse_num(raw)
        if v is None:
            continue
        res.append({'v': v, 's': m.start(), 'e': m.end(), 'raw': raw})
    return res


def _ctx_sign(raw_text, start, end, half=12):
    """token 前后各 half 字符（去空白标点）拼成签名，用于跨文本配对"""
    before = _clean_ctx(raw_text[max(0, start - half):start])
    after = _clean_ctx(raw_text[end:end + half])
    return before[-half:] + '|' + after[:half]


def _match_spans_to_l20(span_signs, l20_text, l20_tokens):
    """把 L1 各 span 的签名与 L20 数值 token 配对（同值优先 + 贪心去重）。
    返回 {span_index: l20_token_index}"""
    cands = []
    for i, (sig, v1) in enumerate(span_signs):
        for j, tk in enumerate(l20_tokens):
            r = SequenceMatcher(None, sig, _ctx_sign(l20_text, tk['s'], tk['e'])).ratio()
            if abs(v1 - tk['v']) < 1e-9:
                r += 0.6  # 数值相同者优先（如静态词缀 10%/15%/25%）
            cands.append((r, i, j))
    cands.sort(key=lambda x: -x[0])
    used_j, assign = set(), {}
    for r, i, j in cands:
        if i in assign or j in used_j:
            continue
        assign[i] = j
        used_j.add(j)
    return assign


def _fmt_derived(value, decimals):
    """整数取整（四舍五入）；小数保留 decimals 位并去尾零"""
    if decimals is None:
        return str(int(value + 0.5)) if value >= 0 else str(int(value - 0.5))
    r = round(value, decimals)
    if abs(r - round(r)) < 1e-9:
        return str(int(round(r)))
    return ('%.*f' % (decimals, r)).rstrip('0').rstrip('.')


def derive_aura_level_affixes(desc_div):
    """光环类被动技能：从详情卡片的两个 explicitMod（1级/20级）等差推导 1~40 级等级词缀。
    与普通被动技能同 schema：返回 [{'level': '1'..'40', 'Descript': '...'}]。
    页面结构变化导致抓不到两点时抛 RuntimeError，不静默产错。"""
    mods = desc_div.find_all('div', class_='explicitMod')
    if len(mods) < 2:
        raise RuntimeError(f"光环技能结构变化: 期望 2 个 explicitMod(1级/20级), 实际 {len(mods)}")
    mod1, mod20 = mods[0], mods[1]
    raw1_text = mod1.get_text()
    raw20_text = mod20.get_text()
    spans1 = mod1.find_all('span', class_='text-mod')
    if not spans1:
        raise RuntimeError("光环技能结构变化: explicitMod 内找不到 span.text-mod 数值")
    l20_tokens = _tokens_raw(raw20_text)

    # 顺序定位每个 span 在 L1 文本中的位置（span 文本可能重复，如 精准投射 两个 +16%）
    span_signs, search_from = [], 0
    for sp in spans1:
        idx = raw1_text.find(sp.text, search_from)
        v = _parse_num(sp.text)
        if v is None or idx == -1:
            raise RuntimeError(f"光环技能结构变化: span 文本解析失败 {sp.text!r}")
        search_from = idx + len(sp.text)
        span_signs.append((_ctx_sign(raw1_text, idx, idx + len(sp.text)), v))

    assign = _match_spans_to_l20(span_signs, raw20_text, l20_tokens)
    deriv = []
    for i, sp in enumerate(spans1):
        v1 = _parse_num(sp.text)
        j = assign.get(i)
        if j is None:
            raise RuntimeError(f"光环技能数值配对失败: L1 span {sp.text!r} 在20级文本中找不到对应数值")
        v20 = l20_tokens[j]['v']
        d = (v20 - v1) / 19.0
        has_dec = ('.' in sp.text or '.' in l20_tokens[j]['raw'])
        deriv.append((i, v1, v20, d, 2 if has_dec else None))

    rows = []
    for lv in range(1, 41):
        div = copy.deepcopy(mod1)
        spans = div.find_all('span', class_='text-mod')
        for (i, v1, v20, d, decimals) in deriv:
            if abs(d) < 1e-9:
                continue  # 静态词缀（如 +10% 速度/+25% 侵略性/-12% 受伤）不替换
            nv = _fmt_derived(v1 + (lv - 1) * d, decimals)
            m = NUM_TOKEN_RE.search(spans[i].text)
            signch, num, pct = m.groups()
            spans[i].string = signch + nv + pct
        rows.append({'level': str(lv), 'Descript': remove_all_spaces(div.get_text())})
    return rows

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
            time.sleep(3 * (2 ** attempt))
    raise last_error


def safe_filename(name):
    """Windows 文件名非法字符替换为 _（全角标点如 ：（）不受影响）"""
    return re.sub(r'[\\/:*?"<>|]', '_', name)


if __name__ == '__main__':
    PassiveSkillEntryJson = {}
    url = 'https://tlidb.com/cn/Passive_Skill'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    PassiveSkillWrapper = soup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2')
    if PassiveSkillWrapper is None:
        raise RuntimeError(f"站点结构变化: {url} 找不到技能列表容器 row row-cols-1 row-cols-lg-3 g-2")
    PassiveSkillDivs = PassiveSkillWrapper.find_all('div', class_='col')
    for PassiveSkillDiv in tqdm(PassiveSkillDivs, desc='被动技能'):
        ClassList = []
        PassiveSkillSpans = PassiveSkillDiv.find_all('span')
        for PassiveSkillSpan in PassiveSkillSpans:
            ClassList.append(remove_all_spaces(PassiveSkillSpan.text))

        HrefA = PassiveSkillDiv.find('a')
        if HrefA is None:
            raise RuntimeError(f"站点结构变化: {url} 技能卡片内找不到 a[href]")
        Href = HrefA['href']
        # 技能图标：列表卡片左侧 a>img（与详情页卡片图标同一 CDN URL）
        IconImg = HrefA.find('img')
        IconUrl = IconImg['src'] if IconImg else ''
        PassiveSkillUrl = 'https://tlidb.com/cn/' + Href
        response = request_page(PassiveSkillUrl)
        PassiveSkillsoup = BeautifulSoup(response.text, 'html.parser')
        NameH1 = PassiveSkillsoup.find('h1')
        if NameH1 is None:
            raise RuntimeError(f"站点结构变化: {PassiveSkillUrl} 找不到 h1 技能名")
        Name = NameH1.text
        PassiveSkillEntryJson[Name] = {}
        PassiveSkillEntryJson[Name]['标签'] = ClassList
        PassiveSkillCard = PassiveSkillsoup.find('div', class_='card ui_item popupItem')
        if PassiveSkillCard is None:
            raise RuntimeError(f"站点结构变化: {PassiveSkillUrl} 找不到 card ui_item popupItem")
        PassiveSkillCardDescDiv = PassiveSkillCard.find('div', class_='px-3 pt-1 pb-3')
        PassiveSkillCardDescRows = PassiveSkillCardDescDiv.find_all('div', class_='explicitMod') if PassiveSkillCardDescDiv else []
        PassiveSkillIntro = next((remove_all_spaces(row.text) for row in PassiveSkillCardDescRows if remove_all_spaces(row.text)), '')
        PassiveSkillEntryJson[Name]['介绍'] = PassiveSkillIntro
        PassiveSkillEntryJson[Name]['等级词缀'] = []
        # 召唤物技能：主卡片 data-block="detail" 内「召唤物技能: 技能A, 技能B...」链接文本（仅魔灵类技能存在）
        PassiveSkillSummonSkills = []
        DetailBlock = PassiveSkillCard.find('div', {'data-block': 'detail'})
        if DetailBlock is not None:
            for DetailA in DetailBlock.find_all('a'):
                SkillText = remove_all_spaces(DetailA.text)
                if SkillText:
                    PassiveSkillSummonSkills.append(SkillText)
        PassiveSkillEntryJson[Name]['召唤物技能'] = PassiveSkillSummonSkills
        # 下载技能图标并记录图片地址（public 相对路径，前端直接引用）
        if IconUrl:
            pic_file = safe_filename(Name) + '.webp'
            download_pic_by_fakeuseragent(logClass, IconUrl, rf'..\TOB_Frontend\public\图片\技能\{SKILL_CATEGORY}\{pic_file}', if_cover=False)
            PassiveSkillEntryJson[Name]['图片地址'] = f'/图片/技能/{SKILL_CATEGORY}/{pic_file}'
        # minion 属性（召唤物基础属性 + 等级成长表）：仅"魔灵"类技能详情页存在 Minion tab-pane
        PassiveSkillMinion = {}
        MinionPane = None
        for TabPane in PassiveSkillsoup.find_all('div', class_='tab-pane'):
            MinionHeader = TabPane.find('h5')
            if MinionHeader is not None and 'Minion' in MinionHeader.text:
                MinionPane = TabPane
                break
        if MinionPane is not None:
            MinionCardBody = MinionPane.find('div', class_='card-body')
            if MinionCardBody is not None:
                MinionBaseAttrs = {}
                for BaseSpan in MinionCardBody.find_all('span', class_='btn'):
                    # span 文本形如 "mana: 1000"，取第一个冒号分割 key/value
                    BaseText = remove_all_spaces(BaseSpan.text)
                    if ':' in BaseText:
                        AttrKey, AttrVal = BaseText.split(':', 1)
                        MinionBaseAttrs[AttrKey] = AttrVal
                PassiveSkillMinion['基础属性'] = MinionBaseAttrs
            MinionTable = MinionPane.find('table')
            if MinionTable is not None:
                MinionThs = MinionTable.find('thead').find_all('th')
                MinionMods = []
                for MinionTr in MinionTable.find('tbody').find_all('tr'):
                    MinionTds = MinionTr.find_all('td')
                    MinionRow = {}
                    for (MinionTh, MinionTd) in zip(MinionThs, MinionTds):
                        MinionRow[remove_all_spaces(MinionTh.text)] = remove_all_spaces(MinionTd.text)
                    MinionMods.append(MinionRow)
                PassiveSkillMinion['成长词缀'] = MinionMods
        PassiveSkillEntryJson[Name]['minion属性'] = PassiveSkillMinion
        PassiveSkillTable = PassiveSkillsoup.find('table')
        if PassiveSkillTable == None:
            # 光环类被动技能（如 法术增幅/魔源）详情页没有逐级等级表，
            # 只有 Simple(L1)/Details(L20) 两个 explicitMod，按等差推导 1~40 级
            if PassiveSkillCardDescDiv is None:
                raise RuntimeError(f"站点结构变化: {PassiveSkillUrl} 找不到卡片描述容器 div.px-3.pt-1.pb-3")
            PassiveSkillEntryJson[Name]['等级词缀'] = derive_aura_level_affixes(PassiveSkillCardDescDiv)
            save_json(PassiveSkillEntryJson, r'..\TOB_Frontend\src\assets\json\技能\被动技能词缀.json')
            continue
        PassiveSkillTbody = PassiveSkillTable.find('tbody')
        PassiveSkillThead = PassiveSkillTable.find('thead')
        PassiveSkillThs = PassiveSkillThead.find_all('th')
        PassiveSkillTrs = PassiveSkillTbody.find_all('tr')
        for PassiveSkillTr in PassiveSkillTrs:
            PassiveSkillTds = PassiveSkillTr.find_all('td')
            PassiveSkillEntryObj = {}
            for (PassiveSkillTh, PassiveSkillTd) in zip(PassiveSkillThs, PassiveSkillTds):
                PassiveSkillEntryObj[remove_all_spaces(PassiveSkillTh.text)] = remove_all_spaces(PassiveSkillTd.text)
            PassiveSkillEntryJson[Name]['等级词缀'].append(PassiveSkillEntryObj)
        save_json(PassiveSkillEntryJson, r'..\TOB_Frontend\src\assets\json\技能\被动技能词缀.json')
