from bs4 import BeautifulSoup
import requests
import os
import json
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import save_json,download_pic_by_fakeuseragent,remove_all_spaces,replace_comma_to_br
from tqdm import tqdm
ua = UserAgent()
# 随机选择一个User-Agent
logClass='追忆复苏模块'

if __name__=='__main__':
    headers = {"user-agent":ua.random}
    #复苏词缀
    print('正在爬取追忆复苏词缀数据...')
    RevivalJson=[]
    RevivalEntryUrl='https://tlidb.com/cn/Memory_Revival#复苏词缀'
    RevivalEntryResponse = requests.get(RevivalEntryUrl, headers=headers)
    RevivalEntrySoup = BeautifulSoup(RevivalEntryResponse.text, 'html.parser')
    RevivalPanel = RevivalEntrySoup.find('div', id='复苏词缀')
    RevivalTbody= RevivalPanel.find('tbody')
    RevivalTrs=RevivalTbody.find_all('tr')
    for RevivalTr in RevivalTrs:
        replace_comma_to_br(RevivalTr)
        RevivalTds=RevivalTr.find_all('td')
        RevivalObj={"Entry":remove_all_spaces(RevivalTds[1].text.strip()),"Tier":f"{remove_all_spaces(RevivalTds[0].text.strip())}","Level":f"{remove_all_spaces(RevivalTds[2].text.strip())}"
                            ,"Weight":f"{remove_all_spaces(RevivalTds[3].text.strip())}"}
        RevivalJson.append(RevivalObj)
    save_json(RevivalJson,r'..\TOB_Frontend\src\assets\json\装备\英雄追忆\追忆复苏词缀.json')
    print('追忆复苏词缀数据爬取完成！')
    
    #复苏词缀(月相)
    print('正在爬取追忆复苏词缀(月相)数据...')
    SpecialRevivalJson=[]
    RevivalEntryUrl='https://tlidb.com/cn/Memory_Revival#复苏词缀（月相）'
    RevivalEntryResponse = requests.get(RevivalEntryUrl, headers=headers)
    RevivalEntrySoup = BeautifulSoup(RevivalEntryResponse.text, 'html.parser')
    RevivalPanel = RevivalEntrySoup.find('div', id='复苏词缀（月相）')
    RevivalTbody= RevivalPanel.find('tbody')
    RevivalTrs=RevivalTbody.find_all('tr')
    for RevivalTr in RevivalTrs:
        replace_comma_to_br(RevivalTr)
        RevivalTds=RevivalTr.find_all('td')
        EntryDescSoup=RevivalTds[1].find('e').get('data-bs-title')
        inner_soup = BeautifulSoup(EntryDescSoup, 'html.parser')
        EntryDesc=remove_all_spaces(inner_soup.text.strip())
        RevivalObj={"Entry":remove_all_spaces(RevivalTds[1].text.strip()),"EntryDesc":EntryDesc,"Tier":f"{remove_all_spaces(RevivalTds[0].text.strip())}","Level":f"{remove_all_spaces(RevivalTds[2].text.strip())}"
                            ,"Weight":f"{remove_all_spaces(RevivalTds[3].text.strip())}"}
        SpecialRevivalJson.append(RevivalObj)
    save_json(SpecialRevivalJson,r'..\TOB_Frontend\src\assets\json\装备\英雄追忆\复苏词缀（月相）.json')
    print('追忆复苏词缀(月相)数据爬取完成！')