from bs4 import BeautifulSoup
import requests
import os
import json
import time
import re
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import save_json,download_pic_by_fakeuseragent,remove_all_spaces
from tqdm import tqdm
ua = UserAgent()
# 随机选择一个User-Agent
logClass='传奇装备模块'

def is_pool_group_title(text):
    """判断词条文本是否为 tlidb 的"随机词缀池"分组标题（如 <词缀列表 3>、<词缀列表 3>已侵蚀）。
    tlidb 详情页里这类 card-header 表示"该槽位会从词缀列表 N 中随机抽取一条"，它不是装备的实际词条；
    正常抓取时分类页 t1 不会出现，但若站点改版把标题混入词条则过滤掉，避免污染词条列表。
    注意：<随机一条XX词缀> 占位符是分类页 t1 的真实词条（代表随机槽位），必须保留，不在此过滤。"""
    t = remove_all_spaces(text)
    return re.match(r'^<词缀列表\s*\d*>.*', t) is not None

def get_pool_cards(soup):
    """解析传奇装备详情页的"随机词缀池"候选卡片。
    DOM 定位：div.card.ui_item 内的 h5.card-header（style 含 #ffc130，标题以 <词缀列表 N> 或
    <随机一条...> 开头，可带"已侵蚀"后缀），同卡片 div.card-body 下的 <li> 即候选词缀。
    普通池与侵蚀池（标题带已侵蚀后缀）同页出现，一并返回。
    返回 [{标题, 候选词缀:[...]}, ...]；无池卡片返回 []（防御：不抛异常）。"""
    pools = []
    for header in soup.find_all('h5', class_='card-header'):
        title = remove_all_spaces(header.get_text())
        if not (title.startswith('<词缀列表') or title.startswith('<随机一条')):
            continue
        card = header.find_parent('div', class_='card')
        if card is None:
            continue
        body = card.find('div', class_='card-body')
        candidates = []
        if body is not None:
            for li in body.find_all('li'):
                for br in li.find_all('br'):
                    br.replace_with(';')
                txt = remove_all_spaces(li.get_text())
                if txt != '':
                    candidates.append(txt)
        pools.append({"标题": title, "候选词缀": candidates})
    return pools

def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，脚本内所有 requests.get 统一走这里。
    重试间隔 3s/6s/12s 递增，重试耗尽仍失败则抛异常（瞬时 SSL 断连不再直接崩溃）。"""
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

def get_panel_wrapper(soup, panel_id):
    """按 tab 面板 id（data-bs-target 对应的 div id，如 '传奇装备'/'传奇装备已侵蚀'）定位面板，
    返回面板内唯一的 row row-cols-1 row-cols-lg-2 g-2 容器；
    面板不存在（该类别无此区块）时返回 None。"""
    panel = soup.find('div', id=panel_id)
    if panel is None:
        return None
    return panel.find('div', class_='row row-cols-1 row-cols-lg-2 g-2')

if __name__ == '__main__':
    url = 'https://tlidb.com/cn/Inventory'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    LegendaryEquipmentsJson={}
    with open(r'base_json\装备分类英转中.json', 'r', encoding='utf-8') as f:
        EquipmentsClassEnToChJson = json.load(f)
    with open(r'base_json\装备分类.json', 'r', encoding='utf-8') as f:
        data=json.load(f)
    total = sum(len(v) for v in data.values())
    with tqdm(total=total, desc="Total items") as bar:
        for key in data.keys():
            if key in ('英雄追忆','Hero_Memories'):
                continue
            for item in data[key]:
                bar.update(1)
                #进入传奇装备界面（页面一次抓取，两个 tab 面板均在其中）
                LegendaryEquipmentUrl = f'https://tlidb.com/cn/{item}'
                response = request_page(LegendaryEquipmentUrl)
                LendaryEquipmentSoup = BeautifulSoup(response.text, 'html.parser')
                # 传奇装备面板：按 tab 面板 id='传奇装备' 定位（等价于旧下标取第 1 个 row-cols 容器）
                LegendaryEquipmentWrapper = get_panel_wrapper(LendaryEquipmentSoup, '传奇装备')
                if(LegendaryEquipmentWrapper!=None):
                    LegendaryEquipmentDivs=LegendaryEquipmentWrapper.find_all('div',class_='d-flex border-top rounded')
                    for legendaryEquipmentDiv in LegendaryEquipmentDivs:
                        LegendaryEquipmentDescDiv=legendaryEquipmentDiv.find('div',class_='flex-grow-1 mx-2 my-1')
                        equipName=LegendaryEquipmentDescDiv.find('a').text
                        if equipName in LegendaryEquipmentsJson:
                            print('already in')
                            continue
                        LegendaryEquipmentPicUrl=  legendaryEquipmentDiv.find('div', class_='flex-grow-1 mx-2 my-1').find_previous_sibling('div').find('img')['src']
                        download_pic_by_fakeuseragent(logClass,LegendaryEquipmentPicUrl,fr"..\TOB_Frontend\public\图片\装备\传奇装备\{equipName}.jpg",False)
                        #获取常规词缀
                        NeededLevel=LegendaryEquipmentDescDiv.find('br').next_sibling.strip()
                        LegendaryEquipmentDescRows=legendaryEquipmentDiv.find_all('div',class_='t1')
                        LengendaryEquipmentEntriesList=[]
                        
                        for LegendaryEquipmentDescRow in LegendaryEquipmentDescRows:
                            for br in LegendaryEquipmentDescRow.find_all('br'):
                                br.replace_with(';')
                            entry_text = remove_all_spaces(LegendaryEquipmentDescRow.text)
                            if entry_text != '' and not is_pool_group_title(entry_text):
                                LengendaryEquipmentEntriesList.append(entry_text)
                        #获取基底词缀
                        equipHref=LegendaryEquipmentDescDiv.find('a')['href']
                        childEquipUrl=f'https://tlidb.com/cn/{equipHref}'
                        childResponse = request_page(childEquipUrl)
                        childLendaryEquipmentSoup = BeautifulSoup(childResponse.text, 'html.parser')
                        baseCol=childLendaryEquipmentSoup.find('div',class_='col')
                        baseEntryDiv=baseCol.find('div',{"data-block": "attrs2"})
                        baseEntry='无'
                        if baseEntryDiv is not None:  # 防御：个别详情页无基底词缀块
                            for br in baseEntryDiv.find_all('br'):
                                    br.replace_with(';')
                            baseEntry=remove_all_spaces(baseEntryDiv.text)
                        if baseEntry == '':
                            baseEntry = '无'  # 空基底词缀标注为"无"，保持字段存在避免前端误判
                        # 随机词缀池：详情页 h5.card-header(#ffc130) 池卡片（普通池+已侵蚀池同页）
                        pool_cards = get_pool_cards(childLendaryEquipmentSoup)
                        EquipObj={
                            "类别":EquipmentsClassEnToChJson[key],
                            "细分类":EquipmentsClassEnToChJson[item],
                            "物品名称":equipName,
                            "需求等级":NeededLevel,
                            "基底词缀":baseEntry,
                            "词条":LengendaryEquipmentEntriesList,
                            "随机词缀池":pool_cards,
                        }
                        LegendaryEquipmentsJson[equipName]=EquipObj
                # 传奇装备已侵蚀面板：按 tab 面板 id='传奇装备已侵蚀' 定位。
                # Belt 页多出的"调香秘仪"面板在 id 锚点下天然被跳过，无需再像旧下标那样偏移 2/1。
                LegendaryEquipmentCorruptedWrapper = get_panel_wrapper(LendaryEquipmentSoup, '传奇装备已侵蚀')
                if(LegendaryEquipmentCorruptedWrapper!=None):
                    LegendaryEquipmentCrruptedDivs=LegendaryEquipmentCorruptedWrapper.find_all('div',class_='d-flex border-top rounded')
                    for legendaryEquipmentCorruptedDiv in LegendaryEquipmentCrruptedDivs:
                        LegendaryEquipmentCorruptedDescDiv=legendaryEquipmentCorruptedDiv.find('div',class_='flex-grow-1 mx-2 my-1')
                        equipName=LegendaryEquipmentCorruptedDescDiv.find('a').text
                        if equipName not in LegendaryEquipmentsJson:
                            print(f'跳过无主体记录的侵蚀装备: {equipName}')
                            continue
                        LegendaryEquipmentCorruptedDescRows=legendaryEquipmentCorruptedDiv.find_all('div',class_='t0')
                        
                        LengendaryEquipmentCorruptedEntriesList=[]
                        for LegendaryEquipmentCorruptedDescRow in LegendaryEquipmentCorruptedDescRows:
                            for br in LegendaryEquipmentCorruptedDescRow.find_all('br'):
                                br.replace_with(';')
                            entry_text = remove_all_spaces(LegendaryEquipmentCorruptedDescRow.text)
                            if entry_text != '' and not is_pool_group_title(entry_text):
                                LengendaryEquipmentCorruptedEntriesList.append(entry_text)
                        LegendaryEquipmentsJson[equipName]['侵蚀词条']=LengendaryEquipmentCorruptedEntriesList
                        LegendaryEquipmentsJson[equipName]['图片地址']=fr"/图片/装备/传奇装备/{equipName}.jpg"
    save_json(LegendaryEquipmentsJson,r'..\TOB_Frontend\src\assets\json\装备\传奇装备\传奇装备.json')
