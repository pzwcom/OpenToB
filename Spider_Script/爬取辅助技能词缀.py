# -*- coding: utf-8 -*-
from bs4 import BeautifulSoup
import requests
import re
import time
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, download_pic_by_fakeuseragent
from tqdm import tqdm

ua = UserAgent()
logClass = '辅助技能模块'
SKILL_CATEGORY = '辅助技能'  # public/图片/技能/ 下的子目录名

def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，脚本内所有 requests.get 统一走这里。
    重试间隔 3s/6s/12s 递增，重试耗尽仍失败则抛异常。"""
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
            time.sleep(3 * (2 ** attempt))
    raise last_error


def safe_filename(name):
    """Windows 文件名非法字符替换为 _（全角标点如 ：（）不受影响）"""
    return re.sub(r'[\\/:*?"<>|]', '_', name)


if __name__ == '__main__':
    SupportSkillEntryJson = {}
    url = 'https://tlidb.com/cn/Support_Skill'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    SupportSkillWrapper = soup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2')
    if SupportSkillWrapper is None:
        raise RuntimeError(f"站点结构变化: {url} 找不到技能列表容器 row row-cols-1 row-cols-lg-3 g-2")
    SupportSkillDivs = SupportSkillWrapper.find_all('div', class_='col')
    for SupportSkillDiv in tqdm(SupportSkillDivs, desc='辅助技能'):
        ClassList = []
        SupportSkillSpans = SupportSkillDiv.find_all('span')
        for SupportSkillSpan in SupportSkillSpans:
            ClassList.append(remove_all_spaces(SupportSkillSpan.text))

        HrefA = SupportSkillDiv.find('a')
        if HrefA is None:
            raise RuntimeError(f"站点结构变化: {url} 技能卡片内找不到 a[href]")
        Href = HrefA['href']
        # 技能图标：列表卡片左侧 a>img（与详情页卡片图标同一 CDN URL）
        IconImg = HrefA.find('img')
        IconUrl = IconImg['src'] if IconImg else ''
        SupportSkillUrl = 'https://tlidb.com/cn/' + Href
        response = request_page(SupportSkillUrl)
        SupportSkillsoup = BeautifulSoup(response.text, 'html.parser')
        NameH1 = SupportSkillsoup.find('h1')
        if NameH1 is None:
            raise RuntimeError(f"站点结构变化: {SupportSkillUrl} 找不到 h1 技能名")
        Name = NameH1.text
        SupportSkillEntryJson[Name] = {}
        SupportSkillEntryJson[Name]['标签'] = ClassList
        SupportSkillCard = SupportSkillsoup.find('div', class_='card ui_item popupItem')
        if SupportSkillCard is None:
            raise RuntimeError(f"站点结构变化: {SupportSkillUrl} 找不到 card ui_item popupItem")
        SupportSkillCardDescDiv = SupportSkillCard.find('div', class_='px-3 pt-1 pb-3')
        SupportSkillCardDescRows = SupportSkillCardDescDiv.find_all('div', class_='explicitMod') if SupportSkillCardDescDiv else []
        SupportSkillIntro = next((remove_all_spaces(row.text) for row in SupportSkillCardDescRows if remove_all_spaces(row.text)), '')
        SupportSkillEntryJson[Name]['介绍'] = SupportSkillIntro
        SupportSkillEntryJson[Name]['等级词缀'] = []
        # 下载技能图标并记录图片地址（public 相对路径，前端直接引用）
        if IconUrl:
            pic_file = safe_filename(Name) + '.webp'
            download_pic_by_fakeuseragent(logClass, IconUrl, rf'..\TOB_Frontend\public\图片\技能\{SKILL_CATEGORY}\{pic_file}', if_cover=False)
            SupportSkillEntryJson[Name]['图片地址'] = f'/图片/技能/{SKILL_CATEGORY}/{pic_file}'
        SupportSkillTable = SupportSkillsoup.find('table')
        if SupportSkillTable == None:
            save_json(SupportSkillEntryJson, r'..\TOB_Frontend\src\assets\json\技能\辅助技能词缀.json')
            continue
        SupportSkillTbody = SupportSkillTable.find('tbody')
        SupportSkillThead = SupportSkillTable.find('thead')
        SupportSkillThs = SupportSkillThead.find_all('th')
        SupportSkillTrs = SupportSkillTbody.find_all('tr')
        for SupportSkillTr in SupportSkillTrs:
            SupportSkillTds = SupportSkillTr.find_all('td')
            SupportSkillEntryObj = {}
            for (SupportSkillTh, SupportSkillTd) in zip(SupportSkillThs, SupportSkillTds):
                SupportSkillEntryObj[remove_all_spaces(SupportSkillTh.text)] = remove_all_spaces(SupportSkillTd.text)
            SupportSkillEntryJson[Name]['等级词缀'].append(SupportSkillEntryObj)
        save_json(SupportSkillEntryJson, r'..\TOB_Frontend\src\assets\json\技能\辅助技能词缀.json')
