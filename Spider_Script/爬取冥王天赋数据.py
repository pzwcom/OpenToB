from bs4 import BeautifulSoup
import requests
import time
import html
from fake_useragent import UserAgent
from utils import remove_all_spaces, save_json, download_pic_by_fakeuseragent, replace_comma_to_br
ua = UserAgent()
# 随机选择一个User-Agent
logClass = '冥王天赋模块'


def clean_tooltip(html_str):
    """把 data-bs-title 的 HTML 壳清洗成纯文本：剥标签、<br>→';'、反转义实体、去空白"""
    if not html_str:
        return ''
    inner = BeautifulSoup(html.unescape(html_str), 'html.parser')
    for br in inner.find_all('br'):
        br.replace_with(';')
    return remove_all_spaces(html.unescape(inner.get_text()))


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


if __name__ == '__main__':
    url = 'https://tlidb.com/cn/Nether_Kings_Divinity'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'html.parser')

    # ============ 1. 冥王天赋点（#冥王 tab，92 个） ============
    TalentEntryJson = {}
    TalentWrapper = soup.find('div', id='冥王')
    if not TalentWrapper:
        raise RuntimeError('未找到 #冥王 tab 容器，站点结构可能已改版')
    TalentDivs = TalentWrapper.find_all('div', class_='col')
    if not TalentDivs:
        raise RuntimeError('#冥王 tab 内未找到天赋卡片(div.col)，站点结构可能已改版')
    for TalentDiv in TalentDivs:
        TalentNameSpan = TalentDiv.find('span', attrs={'data-talent-id': True})
        if not TalentNameSpan:
            continue
        TalentClass = remove_all_spaces(TalentNameSpan.text.strip())
        TalentId = TalentNameSpan['data-talent-id']
        if TalentClass not in TalentEntryJson:
            TalentEntryJson[TalentClass] = []
        # 数量上限（最后一个 span，形如 0/1）
        headerDiv = TalentDiv.find('div', class_='d-flex justify-content-between')
        LimitSpan = headerDiv.find_all('span')[-1]
        Limit = remove_all_spaces(LimitSpan.text.strip())
        # 词缀文本：移除头部与分割线后取余下文本
        headerDiv.decompose()
        hrTag = TalentDiv.find('hr')
        if hrTag:
            hrTag.decompose()
        TalentText = remove_all_spaces(TalentDiv.text.strip())
        # 提示（e 标签 Hyperlink 的 data-bs-title，HTML 壳 → 纯文本）
        TalentTips = TalentDiv.find_all('e')
        TipsObj = {}
        for Tip in TalentTips:
            TipsObj[f"{remove_all_spaces(Tip.text.strip())}"] = clean_tooltip(Tip.get('data-bs-title', ''))
        TalentObj = {"talent_id": TalentId, "名称": TalentClass, "上限": Limit, "词缀": TalentText, "提示": TipsObj}
        TalentEntryJson[TalentClass].append(TalentObj)
    save_json(TalentEntryJson, r"..\TOB_Frontend\src\assets\json\装备\神格石板\冥王天赋\冥王天赋点.json")

    # ============ 2. 冥王的神格石板（#Item tab，3 块） ============
    SlateEntryJson = {}
    ItemWrapper = soup.find('div', id='Item')
    if not ItemWrapper:
        raise RuntimeError('未找到 #Item tab 容器，站点结构可能已改版')
    ItemDivs = ItemWrapper.find_all('div', class_='col')
    if not ItemDivs:
        raise RuntimeError('#Item tab 内未找到石板卡片(div.col)，站点结构可能已改版')
    for ItemDiv in ItemDivs:
        img = ItemDiv.find('img')
        img_url = img['src']
        descDiv = ItemDiv.find('div', class_='flex-grow-1 mx-2 my-1')
        a = descDiv.find('a')
        SlateName = remove_all_spaces(a.text.strip())
        # 词缀与提示（data-bs-title 的 HTML 壳 → 纯文本）
        SlateText = remove_all_spaces(descDiv.text.strip())
        SlateTips = descDiv.find_all('e')
        TipsObj = {}
        for Tip in SlateTips:
            TipsObj[f"{remove_all_spaces(Tip.text.strip())}"] = clean_tooltip(Tip.get('data-bs-title', ''))
        # 下载图片
        SlatePicPath = fr"..\TOB_Frontend\public\图片\装备\神格石板\冥王神格石板\{SlateName}.jpg"
        download_pic_by_fakeuseragent(logClass, img_url, SlatePicPath)
        SlateEntryObj = {"名称": SlateName, "词缀": SlateText, "提示": TipsObj, "图片地址": fr"/图片/装备/神格石板/冥王神格石板/{SlateName}.jpg"}
        SlateEntryJson[SlateName] = SlateEntryObj
    save_json(SlateEntryJson, r"..\TOB_Frontend\src\assets\json\装备\神格石板\冥王天赋\冥王神格石板.json")

    # ============ 3. 放逐的基底词缀（#冥王的神格 说明面板，"冥王的神格：放逐"段落） ============
    # 页面第三个 tab 是系统说明：放逐神格石板的基底词缀（特殊效果）有 10 组，
    # 形如「放逐：破击」+ 嵌套 ul 内 1~3 条效果描述。审判/侵染各自只有 1 条描述，未做结构化解构。
    ShengeWrapper = soup.find('div', id='冥王的神格')
    if not ShengeWrapper:
        raise RuntimeError('未找到 #冥王的神格 说明面板，站点结构可能已改版')
    CardBody = ShengeWrapper.find('div', class_='card-body clearfix')
    if not CardBody:
        raise RuntimeError('#冥王的神格 面板内未找到 card-body，站点结构可能已改版')
    FangzhuP = None
    for p in CardBody.find_all('p'):
        if remove_all_spaces(p.get_text()) == '冥王的神格：放逐':
            FangzhuP = p
            break
    if not FangzhuP:
        raise RuntimeError('说明面板中未找到"冥王的神格：放逐"段落，站点结构可能已改版')
    FangzhuUl = FangzhuP.find_next_sibling('ul')
    if not FangzhuUl:
        raise RuntimeError('"冥王的神格：放逐"段落后未找到词缀列表 ul，站点结构可能已改版')
    BanishmentEntryJson = {}
    for Li in FangzhuUl.find_all('li', recursive=False):
        replace_comma_to_br(Li)  # 描述内的 <br> 统一转 ';'
        DirectText = ''.join(Li.find_all(string=True, recursive=False)).strip()
        AffixName = DirectText.strip('「」 ')
        DescUl = Li.find('ul')
        if not DescUl:
            raise RuntimeError(f'词缀 {AffixName} 缺少描述列表 ul，站点结构可能已改版')
        DescList = [remove_all_spaces(d.get_text().strip()) for d in DescUl.find_all('li', recursive=False)]
        BanishmentEntryJson[AffixName] = {"名称": AffixName, "描述": ';'.join(DescList)}
    if len(BanishmentEntryJson) < 10:
        raise RuntimeError(f'放逐基底词缀仅解析到 {len(BanishmentEntryJson)} 条（预期 10），站点结构可能已改版')
    save_json(BanishmentEntryJson, r"..\TOB_Frontend\src\assets\json\装备\神格石板\冥王天赋\放逐基底词缀.json")

    print('冥王天赋点类别:', list(TalentEntryJson.keys()))
    print('冥王天赋点总数:', sum(len(v) for v in TalentEntryJson.values()))
    print('神格石板:', list(SlateEntryJson.keys()))
    print('放逐基底词缀:', list(BanishmentEntryJson.keys()))
