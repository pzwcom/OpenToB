# -*- coding: utf-8 -*-
"""爬取 91tob BD 模拟器装备槽位面板背景图标（淡显装备轮廓图）

源: https://www.91tob.com/slot-icons/icon_Slot_XXX.webp
输出: TOB_Frontend/public/图片/背景图片/装备背景图/
运行: 在 Spider_Script/ 目录下执行（依赖 CWD 无关，输出为绝对路径）
"""
import os
from utils import download_pic_by_fakeuseragent

logClass = '91tob装备槽位图标'
BASE_URL = "https://www.91tob.com/slot-icons/"
OUTPUT_DIR = r"E:\我的项目\TOB_react\TOB_Frontend\public\图片\背景图片\装备背景图"

# (远端文件名, 本地保存文件名) —— 去重后共 8 个唯一文件
slots = [
    ("icon_Slot_Weapon.webp",         "icon_Slot_Weapon.webp"),        # 主手武器 + 副手武器 共用
    ("icon_Slot_Helmet.webp",         "icon_Slot_Helmet.webp"),        # 头部
    ("icon_Slot_Chest%20Armor.webp",  "icon_Slot_Chest_Armor.webp"),   # 胸甲（URL 中 %20 转下划线，避免文件名空格）
    ("icon_Slot_Necklace.webp",       "icon_Slot_Necklace.webp"),      # 项链
    ("icon_Slot_Glove.webp",          "icon_Slot_Glove.webp"),         # 手套
    ("icon_Slot_Belt.webp",           "icon_Slot_Belt.webp"),          # 腰带
    ("icon_Slot_Ring.webp",           "icon_Slot_Ring.webp"),          # 左戒指 + 右戒指 共用
    ("icon_Slot_Boot.webp",           "icon_Slot_Boot.webp"),          # 鞋子
]


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    for remote_name, local_name in slots:
        url = BASE_URL + remote_name
        path = os.path.join(OUTPUT_DIR, local_name)
        download_pic_by_fakeuseragent(logClass, url, path, if_cover=True)
        print(f"已请求: {url} -> {path}")


if __name__ == "__main__":
    main()
