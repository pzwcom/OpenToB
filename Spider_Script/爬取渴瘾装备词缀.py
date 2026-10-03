from bs4 import BeautifulSoup
import requests
import time
import os
import re
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, replace_comma_to_br, download_pic_by_fakeuseragent
ua = UserAgent()
# 随机选择一个User-Agent
logClass='渴瘾装备模块'

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

def safe_filename(name):
    """装备名中 Windows 不允许的字符（\/:*?"<>|）替换为 _，避免保存路径报错。
    JSON 里的图片地址同步使用清洗后的名字，保证文件与记录一一对应。"""
    return re.sub(r'[\\/:*?"<>|]', '_', name)

if __name__ == '__main__':
    #打造词缀
    GraftEqipmentCraftJson={}
    #传奇词缀
    GraftLegendaryEquipJson={}
    #基础词缀
    GraftBaseEquipJson={}
    url = 'https://tlidb.com/cn/Graft'
    response = request_page(url)
    GraftEquipmentSoup = BeautifulSoup(response.text, 'html.parser')
    GraftEquipmentHomeWrapper = GraftEquipmentSoup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2')
    GraftEquipmentHomeCols=GraftEquipmentHomeWrapper.find_all('div',class_='col')
    #根据渴瘾主界面找到对应的入口标签
    for GraftEquipmentHomeCol in GraftEquipmentHomeCols:
        href=GraftEquipmentHomeCol.find('div',class_='flex-grow-1 mx-2 my-1').find('a')['href']
        tag=GraftEquipmentHomeCol.find('div',class_='flex-grow-1 mx-2 my-1').find('a').text
        GraftEqipmentCraftJson[tag]={}

        #1.打造词缀（request_page 内部每次随机 UA，防拒绝访问）
        SubCraftUrl=f'https://tlidb.com/cn/{href}#打造'
        SubResponse = request_page(SubCraftUrl)
        SubCraftSoup = BeautifulSoup(SubResponse.text, 'lxml')
        #分前后缀：打造页为畸形 HTML 必须用 lxml；col-lg-6 按 table caption 文本判定归属，不依赖 DOM 下标
        GraftEqipmentCraftJson[tag]['前缀']=[]
        GraftEqipmentCraftJson[tag]['后缀']=[]
        SubCraftWrappers=SubCraftSoup.find_all('div',class_="col-lg-6")
        if len(SubCraftWrappers) != 2:
            raise RuntimeError(f"[渴瘾装备] {tag} 打造页 col-lg-6 数量异常: {len(SubCraftWrappers)}（期望 2），页面结构可能改版")
        for SubCraftWrapper in SubCraftWrappers:
            SubCraftTable = SubCraftWrapper.find('table')
            SubCraftCaption = SubCraftTable.find('caption') if SubCraftTable else None
            entryClass = remove_all_spaces(SubCraftCaption.text) if SubCraftCaption else None
            if entryClass not in ('前缀','后缀'):
                raise RuntimeError(f"[渴瘾装备] {tag} 打造页 caption 缺失/异常: {entryClass}（期望 前缀/后缀），页面结构可能改版")
            SubCraftTbody=SubCraftWrapper.find('tbody')
            if SubCraftTbody is None:
                raise RuntimeError(f"[渴瘾装备] {tag} 打造页 {entryClass} 表内找不到 tbody，页面结构可能改版")
            SubCraftTrs=SubCraftTbody.find_all('tr')
            for SubCraftTr in SubCraftTrs:
                replace_comma_to_br(SubCraftTr)
                SubCraftTds=SubCraftTr.find_all('td')
                SubCraftEntryObj={"Entry":remove_all_spaces(SubCraftTds[1].text.strip()),"Tier":f"{remove_all_spaces(SubCraftTds[0].text)}","Level":f"{remove_all_spaces(SubCraftTds[2].text)}"
                                ,"Weight":f"{remove_all_spaces(SubCraftTds[3].text)}","Library":f"{remove_all_spaces(SubCraftTds[4].text)}"
                                } 
                GraftEqipmentCraftJson[tag][entryClass].append(SubCraftEntryObj)
        
        #2.装备渴瘾装备传奇词缀
        SubLegendaryEquipUrl=f'https://tlidb.com/cn/{href}#传奇品质'
        SubGraftLegendaryEquipResponse=request_page(SubLegendaryEquipUrl)
        SubGRraftLegendarySoup=BeautifulSoup(SubGraftLegendaryEquipResponse.text,'html.parser')
        SubGRraftLegendaryWrapper=SubGRraftLegendarySoup.find('div',class_='row row-cols-1 row-cols-lg-2 g-2')
        SubGRraftLegendaryDivs=SubGRraftLegendaryWrapper.find_all('div',class_='d-flex border-top rounded')
        GraftLegendaryEquipJson[tag]={}
        for SubGraftLegendaryDiv in SubGRraftLegendaryDivs:
            SubGraftLegendaryDescDiv=SubGraftLegendaryDiv.find('div',class_='flex-grow-1 mx-2 my-1')
            equipName=SubGraftLegendaryDescDiv.find('a').text
            #获取常规词缀
            NeededLevel=SubGraftLegendaryDescDiv.find('br').next_sibling.strip()
            SubGraftLegendaryDescRows=SubGraftLegendaryDiv.find_all('div',class_='t1')
            LengendaryEquipmentEntriesList=[]
            for SubGraftLegendaryDescRow in SubGraftLegendaryDescRows:
                for br in SubGraftLegendaryDescRow.find_all('br'):
                    br.replace_with(';')
                LengendaryEquipmentEntriesList.append(remove_all_spaces(SubGraftLegendaryDescRow.text))
            EquipObj={
                        "物品名称":equipName,
                        "需求等级":NeededLevel,
                        "词条":LengendaryEquipmentEntriesList,
                    }
            GraftLegendaryEquipJson[tag][equipName]=EquipObj
        
        #渴瘾装备的基础词缀
        SubBaseEquipUrl=f'https://tlidb.com/cn/{href}#基础词缀'
        SubBaseEquipResponse = request_page(SubBaseEquipUrl)
        SubBaseEquipSoup = BeautifulSoup(SubBaseEquipResponse.text, 'html.parser')
        #按 tab 面板 id='基础词缀' 锚定 tbody，替代全页 find_all('tbody')[2]（页面新增表会错位）
        SubBaseEquipPanel = SubBaseEquipSoup.find('div', id='基础词缀')
        if SubBaseEquipPanel is None:
            raise RuntimeError(f"[渴瘾装备] {tag} 页面找不到 id='基础词缀' 面板，页面结构可能改版")
        EquipmentBaseEntryTbody = SubBaseEquipPanel.find('tbody')
        if EquipmentBaseEntryTbody is None:
            raise RuntimeError(f"[渴瘾装备] {tag} 基础词缀面板内找不到 tbody，页面结构可能改版")
        GraftBaseEquipJson[tag]=[]
        EquipmentBaseEntryTrs=EquipmentBaseEntryTbody.find_all('tr')
        for EquipmentBaseEntryTr in EquipmentBaseEntryTrs:
            replace_comma_to_br(EquipmentBaseEntryTr)
            EquipmentBaseEntryTds=EquipmentBaseEntryTr.find_all('td')
            EquipmentBaseEntryObj={"Entry":remove_all_spaces(EquipmentBaseEntryTds[1].text.strip()),"Tier":f"{remove_all_spaces(EquipmentBaseEntryTds[0].text.strip())}","Level":f"{remove_all_spaces(EquipmentBaseEntryTds[2].text.strip())}"
                                ,"Weight":f"{remove_all_spaces(EquipmentBaseEntryTds[3].text.strip())}"}
            GraftBaseEquipJson[tag].append(EquipmentBaseEntryObj)

        #4.渴瘾装备部位图标（#Item 页签，每个部位 1 张装备图标）
        SubItemUrl=f'https://tlidb.com/cn/{href}#Item'
        SubItemResponse = request_page(SubItemUrl)
        SubItemSoup = BeautifulSoup(SubItemResponse.text, 'html.parser')
        #按 tab 面板 id='Item' 锚定，避免与打造/传奇等 tab 的同类卡片混淆
        SubItemPanel = SubItemSoup.find('div', id='Item')
        if SubItemPanel is None:
            raise RuntimeError(f"[渴瘾装备] {tag} 页面找不到 id='Item' 面板，页面结构可能改版")
        SubItemCard = SubItemPanel.find('div', class_='d-flex border-top rounded')
        SubItemImg = None
        if SubItemCard is not None:
            SubItemImgDiv = SubItemCard.find('div', class_='flex-shrink-0')
            if SubItemImgDiv is not None:
                SubItemImg = SubItemImgDiv.find('img')
        SubItemPicUrl = SubItemImg.get('src') if SubItemImg is not None else None
        if SubItemPicUrl:
            # 保留原扩展名（站点为 webp），文件名用清洗后的部位 tag 名
            picExt = os.path.splitext(SubItemPicUrl.split('?')[0])[1] or '.webp'
            picFileName = f"{safe_filename(tag)}{picExt}"
            download_pic_by_fakeuseragent(logClass, SubItemPicUrl, fr"..\TOB_Frontend\public\图片\装备\渴瘾装备\{tag}\{picFileName}", False)
        else:
            print(f"[渴瘾装备] {tag} 的 #Item 面板内未找到图片，跳过该部位图片下载")

    #三个 JSON 在全部 tag 循环结束后各保存一次，避免中途崩溃留下半成品
    save_json(GraftEqipmentCraftJson,r'..\TOB_Frontend\src\assets\json\装备\渴瘾装备\打造词缀.json')
    save_json(GraftLegendaryEquipJson,r'..\TOB_Frontend\src\assets\json\装备\渴瘾装备\传奇词缀.json')
    save_json(GraftBaseEquipJson,r'..\TOB_Frontend\src\assets\json\装备\渴瘾装备\基础词缀.json')
