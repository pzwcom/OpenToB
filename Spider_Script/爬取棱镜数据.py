from bs4 import BeautifulSoup
import requests
import os
import json
import re
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import save_json,download_pic_by_fakeuseragent,remove_all_spaces,replace_comma_to_br
ua = UserAgent()
# 随机选择一个User-Agent
logClass='棱镜模块'
if __name__=="__main__":
    #基础词缀爬取
    PrismBaseEntryJson=[]
    url='https://tlidb.com/cn/Ethereal_Prism#基础词缀'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    baseEntryTbody=soup.find('tbody')
    Trs=baseEntryTbody.find_all('tr')
    for Tr in Trs:
        replace_comma_to_br(Tr)
        text=remove_all_spaces(Tr.text.strip())
        PrismBaseEntryJson.append(text)
    save_json(PrismBaseEntryJson,r'..\TOB_Frontend\src\assets\json\装备\棱镜\基础词缀.json')

    #随机词缀爬取
    Prism_RndomEntryJson=[]
    url='https://tlidb.com/cn/Ethereal_Prism#随机词缀'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    randomEntryTbody=soup.find_all('tbody')[1]
    Trs=randomEntryTbody.find_all('tr')
    for Tr in Trs:
        replace_comma_to_br(Tr)
        Tds=Tr.find_all('td')
        entry=remove_all_spaces(Tds[0].text.strip())
        location=remove_all_spaces(Tds[1].text.strip()) if len(Tds)>1 else ''
        rarety=location.split('-')[-1] if '-' in location else ''
        #网页未分分类，带"影响范围"的词缀属于"影响范围"类，其余无出现位置的"异化核心天赋"词缀实际为棱镜校尺-传奇
        category='影响范围' if '影响范围' in entry else ''
        if not rarety and not category:
            rarety='传奇'
            location='棱镜校尺-传奇'
        #源站部分异化核心天赋词缀（如"运筹帷幄"）漏写 [核心天赋名] 括号，
        #统一补全为 [运筹帷幄]，保证前端能按棱镜种类过滤（见 3.6.1 括号过滤规则）
        if not category and '为当前天赋板核心天赋附加：' in entry and '[' not in entry:
            entry=entry.replace('附加：','附加：[',1)
            entry=entry.replace(';','];',1)
        Prism_RndomEntryJson.append({'entry':entry,'rarety':rarety,'location':location,'category':category})
    save_json(Prism_RndomEntryJson,r'..\TOB_Frontend\src\assets\json\装备\棱镜\随机词缀.json')

    #棱镜图片以及种类爬取
    PrismJson={}
    url='https://tlidb.com/cn/Ethereal_Prism#Item'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    wrapper=soup.find('div',class_='row row-cols-1 row-cols-lg-3 g-2')
    divs=wrapper.find_all('div',class_='col')
    for div in divs:
        imgurl=div.find('img')['src']
        descdiv=div.find('div',class_='flex-grow-1 mx-2 my-1')
        replace_comma_to_br(descdiv)
        name_a=descdiv.find('a')
        name=remove_all_spaces(name_a.text.strip())
        name_a.decompose()
        dsc=remove_all_spaces(descdiv.text.strip())
        download_pic_by_fakeuseragent(logClass,imgurl,fr"..\TOB_Frontend\public\图片\装备\棱镜\{name}.jpg",if_cover=False)
        obj={'name':name,'desc':dsc,'imgPath':f'/图片/装备/棱镜/{name}.jpg','rarety':'稀有' if '朦胧' in name else '传奇'}
        PrismJson[name]=obj
    PrismJson['逆像']={'name':'逆像','desc':'将范内所有天赋映射到镜像区域，映射区域内所有天赋无前置要求','imgPath':'','rarety':'至臻'}
    save_json(PrismJson,r'..\TOB_Frontend\src\assets\json\装备\棱镜\棱镜图片及种类.json')

    #逆像（Inverse_Image 独立页面，非棱镜 Item 页）
    url='https://tlidb.com/cn/Inverse_Image'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    InverseCards=soup.select('div.col div.card.ui_item.popupItem')
    if not InverseCards:
        raise RuntimeError('未找到逆像卡片，站点结构可能已变化')
    card=InverseCards[0]
    name=remove_all_spaces(card.select_one('h5.card-title').get_text(strip=True))
    imgurl=card.find('img')['src']
    detailDiv=card.find('div',attrs={'data-block':'detail'})
    detail=remove_all_spaces(detailDiv.get_text(' ',strip=True)) if detailDiv else ''
    modifierSpan=card.find('span',attrs={'data-modifier-id':True})
    modifier=remove_all_spaces(modifierSpan.get_text(' ',strip=True)) if modifierSpan else ''
    dsc=f'{detail};{modifier}'
    download_pic_by_fakeuseragent(logClass,imgurl,fr"..\TOB_Frontend\public\图片\装备\棱镜\{name}.jpg",if_cover=False)
    PrismJson['逆像']={'name':name,'desc':dsc,'imgPath':f'/图片/装备/棱镜/{name}.jpg','rarety':'至臻'}
    save_json(PrismJson,r'..\TOB_Frontend\src\assets\json\装备\棱镜\棱镜图片及种类.json')