from bs4 import BeautifulSoup
import requests
import os
import json
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import remove_all_spaces,download_pic_by_fakeuseragent,save_json
ua = UserAgent()
# 随机选择一个User-Agent
logClass='追忆模块'
if __name__ == '__main__':
    
    #下载追忆图片
    url = 'https://tlidb.com/cn/Hero_Memories#Item'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    MemoriesPicLocationjson={}
    Memories=["本源的追忆","守己的追忆","奋进的追忆"]
    MemoryItemPicWrapper=soup.find('div',class_='row row-cols-1 row-cols-lg-3 g-2')
    MemoryPicDivs=MemoryItemPicWrapper.find_all('div',class_="flex-shrink-0")
    for index,MemoryPicDiv in enumerate(MemoryPicDivs):
        MemoryPic=MemoryPicDiv.find('img')
        MemoryPicUrl=MemoryPic['src']
        MemoriesPicLocationjson[Memories[index]]=fr"/图片/装备/英雄追忆/{Memories[index]}.jpg"
        download_pic_by_fakeuseragent(logClass,MemoryPicUrl,fr"..\TOB_Frontend\public\图片\装备\英雄追忆\{Memories[index]}.jpg")
    save_json(MemoriesPicLocationjson,fr"..\TOB_Frontend\src\assets\json\装备\英雄追忆\英雄追忆图片位置.json")
    #下载追忆基础属性
    url = 'https://tlidb.com/cn/Hero_Memories#基础属性'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    MemoriesBaseEntryjson={}
    MemoryBaseEntryTbody=soup.find('div',id='基础属性').find('tbody')
    MemoryBaseEntryTrs=MemoryBaseEntryTbody.find_all('tr')
    for index,MemoryBaseEntryTr in enumerate(MemoryBaseEntryTrs):
        MemoryBaseEntryTds=MemoryBaseEntryTr.find_all('td')
        Tier=remove_all_spaces(MemoryBaseEntryTds[0].text)
        Modifier=remove_all_spaces(MemoryBaseEntryTds[1].text)
        Level=remove_all_spaces(MemoryBaseEntryTds[2].text)
        Weight=remove_all_spaces(MemoryBaseEntryTds[3].text)
        来源=remove_all_spaces(MemoryBaseEntryTds[4].text)
        if(来源 not in MemoriesBaseEntryjson):
            MemoriesBaseEntryjson[来源]=[]
        MemoriesBaseEntryjson[来源].append({"Tier":Tier,"Modifier":Modifier,"Level":Level,"Weight":Weight})
    save_json(MemoriesBaseEntryjson,fr"..\TOB_Frontend\src\assets\json\装备\英雄追忆\英雄追忆基础属性.json")

    #下载追忆固有词缀
    url = 'https://tlidb.com/cn/Hero_Memories#固有词缀'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    MemoriesEntryjson={}
    MemoryEntryTbody=soup.find('div',id='固有词缀').find('tbody')
    MemoryEntryTrs=MemoryEntryTbody.find_all('tr')
    for index,MemoryEntryTr in enumerate(MemoryEntryTrs):
        MemoryEntryTds=MemoryEntryTr.find_all('td')
        Tier=remove_all_spaces(MemoryEntryTds[0].text)
        Modifier=remove_all_spaces(MemoryEntryTds[1].text)
        Level=remove_all_spaces(MemoryEntryTds[2].text)
        Weight=remove_all_spaces(MemoryEntryTds[3].text)
        来源=remove_all_spaces(MemoryEntryTds[4].text)
        if(来源 not in MemoriesEntryjson):
            MemoriesEntryjson[来源]=[]
        MemoriesEntryjson[来源].append({"Tier":Tier,"Modifier":Modifier,"Level":Level,"Weight":Weight})
    save_json(MemoriesEntryjson,fr"..\TOB_Frontend\src\assets\json\装备\英雄追忆\英雄追忆固有词缀.json")
    
    ##下载随机词缀
    url = 'https://tlidb.com/cn/Hero_Memories#随机词缀'
    MemoryRandomEntryjson={}
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    MemoryEntryTbody=soup.find('div',id='随机词缀').find('tbody')
    MemoryEntryTrs=MemoryEntryTbody.find_all('tr')
    for index,MemoryEntryTr in enumerate(MemoryEntryTrs):
        MemoryEntryTds=MemoryEntryTr.find_all('td')
        Tier=remove_all_spaces(MemoryEntryTds[0].text)
        Modifier=remove_all_spaces(MemoryEntryTds[1].text)
        Level=remove_all_spaces(MemoryEntryTds[2].text)
        Weight=remove_all_spaces(MemoryEntryTds[3].text)
        来源=remove_all_spaces(MemoryEntryTds[4].text)
        if(来源 not in MemoryRandomEntryjson):
            MemoryRandomEntryjson[来源]=[]
        MemoryRandomEntryjson[来源].append({"Tier":Tier,"Modifier":Modifier,"Level":Level,"Weight":Weight})
    save_json(MemoryRandomEntryjson,fr"..\TOB_Frontend\src\assets\json\装备\英雄追忆\英雄追忆随机词缀.json")