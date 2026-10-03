from bs4 import BeautifulSoup
import requests
import os
import json
import re
import time
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import save_json,check_resorce_if_exist_and_download,remove_all_spaces,replace_comma_to_br,download_pic_by_fakeuseragent
from tqdm import tqdm
ua = UserAgent()
# 随机选择一个User-Agent
logClass='契灵模块'

def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，脚本内所有 requests.get 统一走这里。
    重试间隔 3s/6s/12s 递增，重试耗尽仍失败则抛异常。"""
    last_error = None
    for attempt in range(max_retry):
        headers = {"user-agent": ua.random, "referer": "https://tlidb.com/cn/"}
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

if __name__ == '__main__':
    # 下载契灵词缀以及契灵图片
    PactspiritEntryJson={}
    url = 'https://tlidb.com/cn/Pactspirit'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    PactspiritWrapper = soup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2')
    if PactspiritWrapper is None:
        raise RuntimeError(f"列表容器(row row-cols-1 row-cols-lg-3 g-2)未找到，页面结构可能改版: {url}")
    PactspiritDivs=PactspiritWrapper.find_all('div', class_='col')
    print('开始下载契灵图片数据.......')
    for PactspiritDiv in tqdm(PactspiritDivs):
        imgTag=PactspiritDiv.find('img')
        if imgTag is None:
            raise RuntimeError(f"契灵卡片未找到图片标签(img)，页面结构可能改版: {url}")
        imgUrl=imgTag['src']
        
        PactspiritDescDiv=PactspiritDiv.find('div', class_='flex-grow-1 mx-2 my-1')
        if PactspiritDescDiv is None:
            raise RuntimeError(f"契灵卡片未找到描述容器(flex-grow-1 mx-2 my-1)，页面结构可能改版: {imgUrl}")
        # 稀有度：稀有度 span 的 class 以 item_rarity 开头（item_rarity2=魔法/item_rarity100=传奇等），语义化定位而非取第 1 个 div
        raritySpan=PactspiritDescDiv.find('span', class_=re.compile(r'item_rarity'))
        if raritySpan is None:
            raise RuntimeError(f"契灵卡片未找到稀有度标签(span.item_rarity*)，页面结构可能改版: {imgUrl}")
        RarityClass=raritySpan.text
        raritySpan.decompose()
        # 战斗分类：稀有度所在的第一个 div，去掉稀有度 span 后剩余文本（如"攻击"/"掉落"）
        combatDiv=PactspiritDescDiv.find('div')
        if combatDiv is None:
            raise RuntimeError(f"契灵卡片未找到战斗分类 div，页面结构可能改版: {imgUrl}")
        CombatClass=remove_all_spaces(combatDiv.text)
        PactspiritName=''
        nameLink=PactspiritDescDiv.find('a')
        if(nameLink!=None):
            PactspiritName=remove_all_spaces(nameLink.text)
        else:
            continue
        if(CombatClass=='掉落'):
            #不要掉落宠物
            continue
        check_resorce_if_exist_and_download(logClass,imgUrl,fr'..\TOB_Frontend\public\图片\契灵\{PactspiritName}.png')
        PactspiritEntryJson[PactspiritName]={}
        PactspiritHref=nameLink['href']
        PactSpiritUrl= f'https://tlidb.com/cn/{PactspiritHref}'
        response=request_page(PactSpiritUrl)
        PactspiritSoup=BeautifulSoup(response.text, 'lxml')
        # 契灵本身图片：详情页卡片顶部的契灵形象图，通过 CSS background-image 引用
        # （div.pactspirit_bg 背景大图 / div.icon.pactspirit 圆形头像），不是 <img> 标签。
        # 语义化定位 pactspirit_bg 的 background-image，CDN 与列表页卡片图同源但此前从未落盘。
        PactspiritSelfImgUrl=None
        pactspiritBgDiv=PactspiritSoup.find('div', class_='pactspirit_bg')
        if pactspiritBgDiv is not None:
            bgStyle=pactspiritBgDiv.get('style', '')
            bgMatch=re.search(r"url\('([^']+)'\)", bgStyle)
            if bgMatch:
                PactspiritSelfImgUrl=bgMatch.group(1)
        if PactspiritSelfImgUrl is None:
            raise RuntimeError(f"{PactspiritName} 详情页未找到契灵本身图(div.pactspirit_bg background-image)，页面结构可能改版: {PactSpiritUrl}")
        # if_cover=False 防覆盖；落 {名称}\契灵本身.webp（源为 webp，扩展名与源一致，避免与顶层 {名称}.png 混存）
        download_pic_by_fakeuseragent(logClass, PactspiritSelfImgUrl, fr'..\TOB_Frontend\public\图片\契灵\{PactspiritName}\契灵本身.webp', if_cover=False)
        SmallNodeList=[]
        nodesWrapper=PactspiritSoup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2 mt-3')
        if nodesWrapper==None:
            print(f'跳过(无节点容器): {PactspiritName}')
            PactspiritEntryJson.pop(PactspiritName)
            continue
        nodesDivs=nodesWrapper.find_all('div', class_='col')
        if len(nodesDivs)<9:
            raise RuntimeError(f"{PactspiritName} 详情页节点数量不足9个(实际{len(nodesDivs)})，页面结构可能改版: {PactSpiritUrl}")

        # 节点解析：返回 (标题行文本, 词缀文本, 环指示)。
        # 末行文本是"环指示"（内环影响/中环影响/外环影响/命运），
        # 第 1 行是节点标题（如"攻击伤害Ⅰ"/"未定宿命槽位"），中间行是词缀文本。
        # 注意：普通词缀节点用 词缀文本 作条目名；核心天赋(外环)沿用旧逻辑用 标题行文本 作条目名
        def parse_node_text(nodeDiv):
            nodeDescDiv=nodeDiv.find('div', class_='flex-grow-1 ms-2')
            if nodeDescDiv is None:
                return None,None,None
            nodeDescRows=nodeDescDiv.find_all('div')
            if len(nodeDescRows)<2:
                return None,None,None
            title=remove_all_spaces(nodeDescRows[0].get_text(strip=True))
            ring=nodeDescRows[-1].get_text(strip=True)
            nodeDescRows[0].decompose()
            nodeDescRows[-1].decompose()
            return title,remove_all_spaces(nodeDescDiv.text),ring

        # 按节点特征分类（替代 nodesDivs[:9]/[9]/[10] 下标）：
        # 小型节点=内环（当前站点每只契灵固定 6 内环）
        # 中型节点=中环（固定 3 中环）
        # 核心天赋=外环大节点（所有稀有度都有外环，仅 1 个）
        # 宿命槽位=末行"命运"的节点（共 6 个、图片相同，取第 1 个即可）
        innerNodes=[]    # 内环影响
        middleNodes=[]   # 中环影响
        coreTalent=None  # 外环影响
        destinyNode=None # 命运
        for nodeDiv in nodesDivs:
            title,nodeText,ring=parse_node_text(nodeDiv)
            if title is None:
                raise RuntimeError(f"{PactspiritName} 节点缺少描述容器/行，页面结构可能改版: {PactSpiritUrl}")
            if ring=='内环影响':
                innerNodes.append((nodeDiv,nodeText))
            elif ring=='中环影响':
                middleNodes.append((nodeDiv,nodeText))
            elif ring=='外环影响':
                coreTalent=(nodeDiv,title)
            elif ring=='命运':
                if destinyNode is None:
                    destinyNode=(nodeDiv,None)
        if len(innerNodes)+len(middleNodes)!=9:
            raise RuntimeError(f"{PactspiritName} 内环+中环节点数量异常(内环{len(innerNodes)}+中环{len(middleNodes)}，期望9)，页面结构可能改版: {PactSpiritUrl}")
        if coreTalent is None:
            raise RuntimeError(f"{PactspiritName} 未找到外环(核心天赋)节点，页面结构可能改版: {PactSpiritUrl}")
        if destinyNode is None:
            raise RuntimeError(f"{PactspiritName} 未找到命运(宿命)节点，页面结构可能改版: {PactSpiritUrl}")

        # 按环去重构建节点列表：站点常把同一词缀渲染成多个相同文本节点，
        # 追加前先去重（保持首次出现顺序），去重只影响对应环列表
        def build_ring_list(ringNodes):
            ringList=[]
            seen=set()
            for nodeDiv,nodeText in ringNodes:
                nodeImg=nodeDiv.find('img')
                if nodeImg is None:
                    raise RuntimeError(f"{PactspiritName} 契约节点缺少图片标签，页面结构可能改版: {PactSpiritUrl}")
                check_resorce_if_exist_and_download(logClass,nodeImg['src'],fr'..\TOB_Frontend\public\图片\契灵\{PactspiritName}\{nodeText}.png')
                if nodeText not in seen:
                    seen.add(nodeText)
                    ringList.append({nodeText:f'/图片/契灵/{PactspiritName}/{nodeText}.png'})
            return ringList

        innerList=build_ring_list(innerNodes)
        middleList=build_ring_list(middleNodes)
        # 核心天赋图片（外环大节点，所有稀有度都下载）
        coreImg=coreTalent[0].find('img')
        if coreImg is None:
            raise RuntimeError(f"{PactspiritName} 核心天赋节点缺少图片标签，页面结构可能改版: {PactSpiritUrl}")
        check_resorce_if_exist_and_download(logClass,coreImg['src'],fr'..\TOB_Frontend\public\图片\契灵\{PactspiritName}\{coreTalent[1]}.png')
        coreEntry={coreTalent[1]:f'/图片/契灵/{PactspiritName}/{coreTalent[1]}.png'}
        # 宿命槽位图片：命运节点图片均相同，下载为共享的 宿命.png
        destinyImg=destinyNode[0].find('img')
        if destinyImg is None:
            raise RuntimeError(f"{PactspiritName} 命运(宿命)节点缺少图片标签，页面结构可能改版: {PactSpiritUrl}")
        check_resorce_if_exist_and_download(logClass,destinyImg['src'],r'..\TOB_Frontend\public\图片\契灵\宿命.png')
        destinyEntryText='+6%伤害,+6%召唤物伤害'
        destinyEntry={destinyEntryText:'/图片/契灵/宿命.png'}

        PactspiritEntryJson[PactspiritName]['小型节点']=innerList
        PactspiritEntryJson[PactspiritName]['中型节点']=middleList
        PactspiritEntryJson[PactspiritName]['核心天赋']=coreEntry
        PactspiritEntryJson[PactspiritName]['宿命']=destinyEntry
        # 契约链：按游戏链序输出全部槽位（含重复词缀槽位），顺序为 小型小型中型 ×3 + 核心。
        # 页面原始顺序即 6 内环 + 3 中环 + 1 外环，槽位按 (内环0,内环1,中环0)(内环2,内环3,中环1)(内环4,内环5,中环2) + 核心 展开。
        chainSlot=[]
        def add_chain_slot(slotType,nodeText):
            chainSlot.append({'类型':slotType,'词缀':nodeText,'图片':f'/图片/契灵/{PactspiritName}/{nodeText}.png'})
        innerRawTexts=[nodeText for _,nodeText in innerNodes]
        middleRawTexts=[nodeText for _,nodeText in middleNodes]
        for i in range(3):
            add_chain_slot('小型',innerRawTexts[i*2])
            add_chain_slot('小型',innerRawTexts[i*2+1])
            add_chain_slot('中型',middleRawTexts[i])
        add_chain_slot('核心',coreTalent[1])
        PactspiritEntryJson[PactspiritName]['契约链']=chainSlot
        # 兼容字段：普通词缀 = 小型+中型+核心+宿命（前端已改用分环字段，此字段仅作后备）
        PactspiritEntryJson[PactspiritName]['普通词缀']=innerList+middleList+[coreEntry]+[destinyEntry]
        # 升阶词缀：页面第一个 table（thead 为 ['lv','name']，词缀在 'name' 列），按表头定位词缀列
        LevelNodeTable=PactspiritSoup.find('table')
        if LevelNodeTable is None:
            raise RuntimeError(f"{PactspiritName} 详情页未找到升阶词缀表(table)，页面结构可能改版: {PactSpiritUrl}")
        LevelNodeTbody=LevelNodeTable.find('tbody')
        if LevelNodeTbody is None:
            raise RuntimeError(f"{PactspiritName} 升阶词缀表缺少 tbody，页面结构可能改版: {PactSpiritUrl}")
        LevelNodeTrs=LevelNodeTbody.find_all('tr')
        nameTdIndex=None
        LevelNodeTHead=LevelNodeTable.find('thead')
        if LevelNodeTHead is not None:
            thTexts=[th.get_text(strip=True) for th in LevelNodeTHead.find_all('th')]
            if 'name' in thTexts:
                nameTdIndex=thTexts.index('name')
            elif '名称' in thTexts:
                nameTdIndex=thTexts.index('名称')
            else:
                raise RuntimeError(f"{PactspiritName} 升阶词缀表表头异常({thTexts})，页面结构可能改版: {PactSpiritUrl}")
        if nameTdIndex is None:
            nameTdIndex=1  # 无表头时兜底：第 1 列 lv、第 2 列词缀文本
        LevelNodeList=[]
        for LevelNodeTr in LevelNodeTrs:
            LevelNodeTds=LevelNodeTr.find_all('td')
            if len(LevelNodeTds)<=nameTdIndex:
                raise RuntimeError(f"{PactspiritName} 升阶词缀表某行缺少第{nameTdIndex+1}列(实际{len(LevelNodeTds)}列)，页面结构可能改版: {PactSpiritUrl}")
            LevelNodeTd=LevelNodeTds[nameTdIndex]
            replace_comma_to_br(LevelNodeTd)
            ModifierDivs=LevelNodeTd.find_all('div',class_='modifier')
            for i in range(len(ModifierDivs) - 1):
                ModifierDivs[i].insert_after(";")
            ModifierText=LevelNodeTd.text
            LevelNodeList.append(remove_all_spaces(ModifierText))
        PactspiritEntryJson[PactspiritName]['升阶词缀']=LevelNodeList
        PactspiritEntryJson[PactspiritName]['稀有分类']=RarityClass
        PactspiritEntryJson[PactspiritName]['战斗分类']=CombatClass
        PactspiritEntryJson[PactspiritName]['图片地址']=fr'/图片/契灵/{PactspiritName}.png'
        PactspiritEntryJson[PactspiritName]['契灵本身图片']=fr'/图片/契灵/{PactspiritName}/契灵本身.webp'
    save_json(PactspiritEntryJson,fr'..\TOB_Frontend\src\assets\json\契灵\契灵词缀.json')
