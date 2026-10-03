# -*- coding: utf-8 -*-
from bs4 import BeautifulSoup
import requests
import json
import sys
import time
from fake_useragent import UserAgent
from utils import save_json, remove_all_spaces, replace_comma_to_br, check_resorce_if_exist_and_download
from tqdm import tqdm

ua = UserAgent()
# 随机选择一个User-Agent
logClass = '普通装备物品模块'

def request_page(url, max_retry=4):
    """带超时与指数退避重试的 GET 请求，脚本内所有 requests.get 统一走这里。
    重试间隔 3s/6s/12s 递增，重试耗尽仍失败则抛异常（瞬时网络错误不再直接崩溃）。"""
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

def find_item_cards(soup, url):
    """语义化定位 #Item tab-pane 内的普通物品卡片容器。
    #Item 是页面内 id 唯一的 tab-pane（与传奇面板同页，靠 id 天然隔离）；
    卡片容器缺失时抛明确错误提示站点结构变化。"""
    item_pane = soup.find('div', id='Item')
    if item_pane is None:
        raise RuntimeError(f"站点结构变化: {url} 找不到 id='Item' 的 tab-pane（普通物品列表），旧结构已失效")
    cards = item_pane.find_all('div', class_='d-flex border-top rounded')
    if not cards:
        raise RuntimeError(f"站点结构变化: {url} 的 #Item 面板内没有 .d-flex.border-top.rounded 物品卡片")
    return cards

def extract_item(card, category_zh, subcategory_zh, url):
    """从单张物品卡片提取一条普通装备记录，全部语义化定位：
    - 物品名称: .flex-grow-1 内 a[href] 文本
    - 图片地址: 卡片左侧 .flex-shrink-0 内图标 img[src]
    - 需求等级: .flex-grow-1 内第一个 div（文本以'需求等级'开头）
    - 基底词缀: [data-modifier-id] span 全文（武器类含多条基础属性，用 ; 连接；无则标'无'）
    任一关键节点缺失抛明确错误，防止静默产出残缺数据。"""
    grow = card.find('div', class_='flex-grow-1 mx-2 my-1')
    if grow is None:
        raise RuntimeError(f"站点结构变化: {url} 物品卡片内找不到 .flex-grow-1.mx-2.my-1 描述区")
    name_a = grow.find('a')
    if name_a is None:
        raise RuntimeError(f"站点结构变化: {url} 物品卡片内找不到 a[href] 物品名")
    equip_name = name_a.get_text(strip=True)
    img_wrap = card.find('div', class_='flex-shrink-0')
    if img_wrap is None:
        raise RuntimeError(f"站点结构变化: {url} 物品卡片({equip_name})内找不到 .flex-shrink-0 图标区")
    img = img_wrap.find('img')
    if img is None:
        raise RuntimeError(f"站点结构变化: {url} 物品卡片({equip_name})内找不到图标 img")
    level_div = grow.find('div')  # 第一个 div = 需求等级（已由 2026-08-10 探测验证恒为第一个）
    if level_div is None or not level_div.get_text(strip=True).startswith('需求等级'):
        raise RuntimeError(f"站点结构变化: {url} 物品卡片({equip_name})内找不到'需求等级'div")
    modifier_spans = grow.find_all('span', attrs={'data-modifier-id': True})
    if modifier_spans:
        parts = []
        for span in modifier_spans:
            replace_comma_to_br(span)  # <br> 转 ;
            parts.append(remove_all_spaces(span.get_text()))
        base_entry = ';'.join(parts)
    else:
        base_entry = '无'  # 无基底词缀的白色物品（如部分项链）标注'无'，保持字段存在避免前端误判
    equip_obj = {
        '类别': category_zh,
        '细分类': subcategory_zh,
        '物品名称': equip_name,
        '需求等级': level_div.get_text(strip=True),
        '基底词缀': base_entry,
        '图片地址': f'/图片/装备/普通装备/{equip_name}.webp',
    }
    return equip_obj, img['src']

if __name__ == '__main__':
    # 可选参数：python 爬取普通装备物品.py Helmet 只抓取该组（用于小范围验证），不带参数全量抓取
    test_only = sys.argv[1] if len(sys.argv) > 1 else None
    with open(r'base_json\装备分类.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    with open(r'base_json\装备分类英转中.json', 'r', encoding='utf-8') as f:
        EquipmentsClassEnToChJson = json.load(f)

    NormalEquipmentsJson = {}
    # 进度条总数 = 本次实际处理的组内 item 数（排除英雄追忆；测试模式下只统计指定组）
    total = sum(
        len(v) for k, v in data.items()
        if k not in ('英雄追忆', 'Hero_Memories') and (test_only is None or k == test_only)
    )
    with tqdm(total=total, desc='Total items') as bar:
        for key in data.keys():
            if key in ('英雄追忆', 'Hero_Memories'):
                continue
            if test_only is not None and key != test_only:
                continue
            category_zh = EquipmentsClassEnToChJson.get(key)
            if category_zh is None:
                raise RuntimeError(f"装备分类英转中.json 缺少组 {key} 的类别中文名")
            for item in data[key]:
                bar.update(1)
                if item not in EquipmentsClassEnToChJson:
                    print(f'[警告] 装备分类英转中.json 缺少 {item} 的映射，跳过该 item（未崩溃）')
                    continue
                subcategory_zh = EquipmentsClassEnToChJson[item]
                # 一次抓取整个基础类型页，页内 #Item tab-pane 即普通物品列表。
                # 锚点 #Item 只影响浏览器定位显示，服务端返回同一份 HTML，故 URL 不拼锚点。
                item_url = f'https://tlidb.com/cn/{item}'
                response = request_page(item_url)
                soup = BeautifulSoup(response.text, 'lxml')
                cards = find_item_cards(soup, item_url)
                for card in cards:
                    equip_obj, pic_url = extract_item(card, category_zh, subcategory_zh, item_url)
                    check_resorce_if_exist_and_download(
                        logClass, pic_url,
                        rf"..\TOB_Frontend\public\图片\装备\普通装备\{equip_obj['物品名称']}.webp")
                    # 不同基础类型出现同名物品（如戒指/项链共用名）时后者覆盖前者，key 保持中文名简洁
                    NormalEquipmentsJson[equip_obj['物品名称']] = equip_obj

    save_json(NormalEquipmentsJson, r'..\TOB_Frontend\src\assets\json\装备\普通装备\普通装备.json')
    print(f'[完成] 普通装备物品共 {len(NormalEquipmentsJson)} 条')
