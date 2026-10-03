from bs4 import BeautifulSoup
import requests
import os
import json
from fake_useragent import UserAgent
from 检查工具 import checkFirst
from tqdm import tqdm
from utils import remove_all_spaces,download_pic_by_fakeuseragent,save_json,replace_comma_to_br
ua = UserAgent()
# 随机选择一个User-Agent
logClass='天赋模块'
if __name__ == '__main__':
    url = 'https://tlidb.com/cn'
    headers = {"user-agent":ua.random}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    #主页天赋容器
    HomegiftDiv=soup.find('div', class_='row row-cols-1 row-cols-lg-2 g-2 mt-2')
    #主页天赋容器中的各个天赋容器
    HomegiftEnterDivs=HomegiftDiv.find_all('div',class_='col')
    GiftFileListJson={}
    GiftConnectionsPositionJson={}
    for GiftEnterDiv in tqdm(HomegiftEnterDivs):
        BigGift=GiftEnterDiv.find('div',class_='card')
        BigGiftText=GiftEnterDiv.find('div',class_='card-header').text
        BigGiftText=remove_all_spaces(BigGiftText)
        GiftFileListJson[BigGiftText]={}
        GiftConnectionsPositionJson[BigGiftText]={}
        #小点天赋a标签
        SubGiftAs=BigGift.find_all('a')
        for SubGiftA in SubGiftAs:
            #下载各个主天赋以及次级天赋的图片
            SubGiftText=SubGiftA['data-bs-title']
            print(SubGiftText)
            GiftFileListJson[BigGiftText][SubGiftText]=[]
            GiftConnectionsPositionJson[BigGiftText][SubGiftText]=[]
            img_tag = SubGiftA.find('img')
            if img_tag and img_tag.has_attr('src'):
                img_url = img_tag['src']
                download_pic_by_fakeuseragent(logClass,img_url,fr"..\TOB_Frontend\public\图片\主天赋入口\{SubGiftText}.jpg")
            # 获取次级天赋页面下的所有小天赋以及中型天赋和中型传奇天赋的描述，图片以及加点
            if SubGiftA.has_attr('href'):
                SubGiftUrl='https://tlidb.com/cn/'+SubGiftA['href']+"#ProfessionTree"
                headers = {"user-agent":ua.random}
                SubGiftResponse=requests.get(SubGiftUrl, headers=headers)
                soup=BeautifulSoup(SubGiftResponse.text, 'html.parser')
                # 获取核心天赋
                try:
                    CoreGiftWrapper=soup.find('div',class_='row row-cols-1 row-cols-lg-2 g-2 pb-2')
                    if(CoreGiftWrapper):
                        CoreGiftDivs=CoreGiftWrapper.find_all('div',class_='card-body')
                        for CoreGiftDiv in CoreGiftDivs:
                            img_tags=CoreGiftDiv.find_all('img')
                            for img_tag in img_tags:
                                title_html=img_tag['data-bs-title']
                                title_soup = BeautifulSoup(title_html, 'html.parser')
                                title_text = title_soup.select_one('div.fw-bold').text
                                bold_div = title_soup.select_one('div.fw-bold')
                                if bold_div:
                                    bold_div.decompose()
                                replace_comma_to_br(title_soup)
                                desc_text = title_soup.get_text(strip=True)
                                desc_text=remove_all_spaces(desc_text)
                                print(f'核心天赋_{title_text}{desc_text}')
                                download_pic_by_fakeuseragent(logClass,img_tag['src'],fr"..\TOB_Frontend\public\图片\天赋\{BigGiftText}\{SubGiftText}\核心天赋_{title_text}_{desc_text}.jpg")
                                GiftFileListJson[BigGiftText][SubGiftText].append(f"/图片/天赋/{BigGiftText}/{SubGiftText}/核心天赋_{title_text}_{desc_text}.jpg")
                except:
                    print(f"获取{BigGiftText}的{SubGiftText}的核心天赋失败")
                #获取小天赋
                try:
                    svg_tag = soup.find('svg')
                    gift_nodes=svg_tag.find('g',class_='nodes')
                    img_tags=gift_nodes.find_all('image')
                    level_up_time_tags=gift_nodes.find_all('text',class_='level_up_time')
                    for img_tag,level_up_time_tag in zip(img_tags,level_up_time_tags):
                        title_html=img_tag['data-bs-title']
                        title_soup = BeautifulSoup(title_html, 'html.parser')
                        title_text = title_soup.select_one('div.fw-bold').text
                        bold_div = title_soup.select_one('div.fw-bold')
                        if bold_div:
                            bold_div.decompose()
                        desc_text = title_soup.get_text(separator="，",strip=True)
                        x=img_tag['x']
                        y=img_tag['y']
                        width=img_tag['width']
                        height=img_tag['height']
                        level_up_time=level_up_time_tag.text
                        save_name=f'{x}_{y}_{width}_{height}_{level_up_time}_{title_text}_{desc_text}'
                        save_name=remove_all_spaces(save_name)
                        img_url = img_tag['xlink:href']
                        download_pic_by_fakeuseragent(logClass,img_url,f"..\TOB_Frontend\public\图片\天赋\{BigGiftText}\{SubGiftText}\{save_name}.jpg",False)
                        #保存图片位置到json文件中
                        GiftFileListJson[BigGiftText][SubGiftText].append(f"/图片/天赋/{BigGiftText}/{SubGiftText}/{save_name}.jpg")
                except:
                    print(f"获取{BigGiftText}的{SubGiftText}的小天赋失败")
                # 获取链接条
                try:
                    connection_g_tag=soup.find('g',class_='connections')
                    lines_tags=connection_g_tag.find_all('line')
                    for line_tag in lines_tags:
                        x1=line_tag['x1']
                        y1=line_tag['y1']
                        x2=line_tag['x2']
                        y2=line_tag['y2']
                        GiftConnectionsPositionJson[BigGiftText][SubGiftText].append([x1,y1,x2,y2])
                except:
                    print(f"获取{BigGiftText}的{SubGiftText}的连接位置失败")
    save_json(GiftFileListJson,r"..\TOB_Frontend/src/assets/json/天赋/天赋所对应的图片位置.json")
    save_json(GiftConnectionsPositionJson,r"..\TOB_Frontend/src/assets/json/天赋/天赋所对应的连接位置.json")
