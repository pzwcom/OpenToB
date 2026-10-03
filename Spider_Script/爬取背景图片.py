from bs4 import BeautifulSoup
import requests
import re
from fake_useragent import UserAgent
from utils import download_pic_by_fakeuseragent
ua = UserAgent()
# 随机选择一个User-Agent
logClass='背景图像'
if __name__ == '__main__':
    url = 'https://cdn.tlidb.com/image/ss12_bg.webp'
    headers = {"user-agent":ua.random}
    download_pic_by_fakeuseragent(logClass,url,r'..\TOB_Frontend\public\图片\背景图片\TOB整体背景图像.jpg')