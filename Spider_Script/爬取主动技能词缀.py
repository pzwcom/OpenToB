# -*- coding: utf-8 -*-
from bs4 import BeautifulSoup
import requests
import re
import time
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, download_pic_by_fakeuseragent
from tqdm import tqdm

ua = UserAgent()
logClass = '主动技能模块'
SKILL_CATEGORY = '主动技能'  # public/图片/技能/ 下的子目录名

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
    ActiveSkillEntryJson = {}
    url = 'https://tlidb.com/cn/Active_Skill#主动技能Tag'
    response = request_page(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    ActiveSkillWrapper = soup.find('div', class_='row row-cols-1 row-cols-lg-3 g-2')
    if ActiveSkillWrapper is None:
        raise RuntimeError(f"站点结构变化: {url} 找不到技能列表容器 row row-cols-1 row-cols-lg-3 g-2")
    ActiveSkillDivs = ActiveSkillWrapper.find_all('div', class_='col')
    for ActiveSkillDiv in tqdm(ActiveSkillDivs, desc='主动技能'):
        ClassList = []
        ActiveSkillSpans = ActiveSkillDiv.find_all('span')
        for ActiveSkillSpan in ActiveSkillSpans:
            ClassList.append(remove_all_spaces(ActiveSkillSpan.text))

        HrefA = ActiveSkillDiv.find('a')
        if HrefA is None:
            raise RuntimeError(f"站点结构变化: {url} 技能卡片内找不到 a[href]")
        Href = HrefA['href']
        # 技能图标：列表卡片左侧 a>img（与详情页卡片图标同一 CDN URL）
        IconImg = HrefA.find('img')
        IconUrl = IconImg['src'] if IconImg else ''
        ActiveSkillUrl = 'https://tlidb.com/cn/' + Href
        response = request_page(ActiveSkillUrl)
        ActiveSkillsoup = BeautifulSoup(response.text, 'html.parser')
        NameH1 = ActiveSkillsoup.find('h1')
        if NameH1 is None:
            raise RuntimeError(f"站点结构变化: {ActiveSkillUrl} 找不到 h1 技能名")
        Name = NameH1.text
        ActiveSkillEntryJson[Name] = {}
        ActiveSkillEntryJson[Name]['标签'] = ClassList
        ActiveSkillCard = ActiveSkillsoup.find('div', class_='card ui_item popupItem')
        if ActiveSkillCard is None:
            raise RuntimeError(f"站点结构变化: {ActiveSkillUrl} 找不到 card ui_item popupItem")
        ActiveSkillCardDescDiv = ActiveSkillCard.find('div', class_='px-3 pt-1 pb-3')
        ActiveSkillCardDescRows = ActiveSkillCardDescDiv.find_all('div', class_='explicitMod') if ActiveSkillCardDescDiv else []
        ActiveSkillIntro = next((remove_all_spaces(row.text) for row in ActiveSkillCardDescRows if remove_all_spaces(row.text)), '')
        ActiveSkillEntryJson[Name]['介绍'] = ActiveSkillIntro
        ActiveSkillEntryJson[Name]['等级词缀'] = []
        # 下载技能图标并记录图片地址（public 相对路径，前端直接引用）
        if IconUrl:
            pic_file = safe_filename(Name) + '.webp'
            download_pic_by_fakeuseragent(logClass, IconUrl, rf'..\TOB_Frontend\public\图片\技能\{SKILL_CATEGORY}\{pic_file}', if_cover=False)
            ActiveSkillEntryJson[Name]['图片地址'] = f'/图片/技能/{SKILL_CATEGORY}/{pic_file}'
        ActiveSkillTable = ActiveSkillsoup.find('table')
        if ActiveSkillTable == None:
            save_json(ActiveSkillEntryJson, r'..\TOB_Frontend\src\assets\json\技能\主动技能词缀.json')
            continue
        ActiveSkillTbody = ActiveSkillTable.find('tbody')
        ActiveSkillThead = ActiveSkillTable.find('thead')
        ActiveSkillThs = ActiveSkillThead.find_all('th')
        ActiveSkillTrs = ActiveSkillTbody.find_all('tr')
        for ActiveSkillTr in ActiveSkillTrs:
            ActiveSkillTds = ActiveSkillTr.find_all('td')
            ActiveSkillEntryObj = {}
            for (ActiveSkillTh, ActiveSkillTd) in zip(ActiveSkillThs, ActiveSkillTds):
                ActiveSkillEntryObj[remove_all_spaces(ActiveSkillTh.text)] = remove_all_spaces(ActiveSkillTd.text)
            ActiveSkillEntryJson[Name]['等级词缀'].append(ActiveSkillEntryObj)
        save_json(ActiveSkillEntryJson, r'..\TOB_Frontend\src\assets\json\技能\主动技能词缀.json')
