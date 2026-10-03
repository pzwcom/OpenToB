from bs4 import BeautifulSoup
import requests
import os
import json
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import save_json,download_pic_by_fakeuseragent,remove_all_spaces,replace_comma_to_br
ua = UserAgent()
# 随机选择一个User-Agent
logClass='命运模块'

if __name__ == '__main__':
    # 下载命运词缀
    DestinyEntryJson={}
    url = 'https://tlidb.com/cn/Destiny'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    DestinyWrapper = soup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2')
    DestinyDivs=DestinyWrapper.find_all('div', class_='col')
    for DestinyDiv in DestinyDivs:
        imgUrl=DestinyDiv.find('img')['src']
        DestinyDescDiv=DestinyDiv.find('div', class_='flex-grow-1 mx-2 my-1')
        DestinyDescA=DestinyDescDiv.find('a')
        replace_comma_to_br(DestinyDescDiv)
        DestinyName=remove_all_spaces(DestinyDescA.text)
        download_pic_by_fakeuseragent(logClass,imgUrl,rf'..\TOB_Frontend\public\图片\命运\词缀\{DestinyName}.jpg',if_cover=False)
        DestinyDescA.decompose()
        desc_text=remove_all_spaces(DestinyDescDiv.text)
        DestinyEntryJson[DestinyName]={'name':DestinyName,'desc':desc_text,'imgPath':f'/图片/命运/词缀/{DestinyName}.jpg'}
        
    save_json(DestinyEntryJson,r'..\TOB_Frontend\src\assets\json\命运\命运词缀.json')