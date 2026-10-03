from bs4 import BeautifulSoup
import requests
import os
import json
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from utils import save_json,check_resorce_if_exist_and_download,remove_all_spaces,check_resorce_if_exist_and_download
from tqdm import tqdm
ua = UserAgent()
# 随机选择一个User-Agent
logClass='角色模块'
if __name__ == '__main__':
    url = 'https://tlidb.com/cn'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    heroDiv = soup.find('div', class_='card-header', string=lambda text: text and text.strip() == '英雄').find_next_sibling('div')
    heraAs=heroDiv.find_all('a')
    heroSpecialtyJson={}
    heroPicLacationJson=[]
    heroSpecialtyPicLocationJson={}
    for heroA in tqdm(heraAs):
        heroUrl='https://tlidb.com/cn/'+heroA['href']
        imgUrl=heroA.find('img')['src']
        heroName=heroA['data-bs-title']
        heroSpecialtyJson[heroName]={}
        heroSpecialtyPicLocationJson[heroName]={}
        #下载角色头像
        check_resorce_if_exist_and_download(logClass,imgUrl,fr"..\TOB_Frontend\public\图片\角色\角色头像\{heroName}.jpg")
        heroNameAndLocation={'name':heroName,'location':fr"/图片/角色/角色头像/{heroName}.jpg"}
        heroPicLacationJson.append(heroNameAndLocation)
        headers = {"user-agent":ua.random}
        response = requests.get(heroUrl, headers=headers)
        heroSoup = BeautifulSoup(response.text, 'html.parser')
        heroSpecialtyPannel=heroSoup.find('div',class_='row row-cols-1 row-cols-lg-2 g-2')
        heroSpecialtyDivs=heroSpecialtyPannel.find_all('div',class_='d-flex border-top rounded')
        #下载角色特性图片
        for heroSpecialtyDiv in heroSpecialtyDivs:
            specialtyDescDiv=heroSpecialtyDiv.find('div',class_='flex-grow-1 mx-2 my-1')
            specialtyNameDiv=heroSpecialtyDiv.find('div',class_='fw-bold')
            if specialtyNameDiv!=None:
                imgUrl=heroSpecialtyDiv.find('img')['src']
                specialtyName=specialtyNameDiv.text
                heroSpecialtyPicLocationJson[heroName][specialtyName]=fr"/图片/角色/特性/{heroName}/{specialtyName}.jpg"
                check_resorce_if_exist_and_download(logClass,imgUrl,fr"..\TOB_Frontend\public\图片\角色\特性\{heroName}\{specialtyName}.jpg")
                
                descTextDiv=heroSpecialtyDiv.find_all('div', recursive=False)[-1]
                for br in descTextDiv.find_all('br'):
                    br.replace_with(';')
                descText=remove_all_spaces(descTextDiv.get_text())
                for child_div in specialtyDescDiv.find_all('div'):
                    child_div.decompose()  # 删除该 div
                levelSatisText=specialtyDescDiv.text
                heroSpecialtyJson[heroName][specialtyName]={'desc':remove_all_spaces(descText),'level_up_time':levelSatisText}
    save_json(heroSpecialtyJson,fr"..\TOB_Frontend\src\assets\json\角色\角色特性.json")
    save_json(heroPicLacationJson,fr"..\TOB_Frontend\src\assets\json\角色\角色头像位置.json")
    save_json(heroSpecialtyPicLocationJson,fr"..\TOB_Frontend\src\assets\json\角色\角色特性图片位置.json")