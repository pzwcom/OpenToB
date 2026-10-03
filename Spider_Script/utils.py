
def remove_all_spaces(s: str) -> str:
    return ''.join(ch for ch in s if not ch.isspace())
def check_resorce_if_exist_and_download(logClass,url,path):
    import os
    if not os.path.exists(path):
        download_pic_by_fakeuseragent(logClass,url,path)
def download_pic_by_fakeuseragent(logClass,img_url,img_output_path,if_cover=True):
    from fake_useragent import UserAgent
    import requests
    import os
    import logging
    import datetime
    #日志设置
    log_dir="E:\TOBnew\日志\爬虫日志"
    log_filename = f"{logClass}爬虫日志_"+datetime.datetime.now().strftime("%Y%m%d") + ".log"
    log_path = os.path.join(log_dir, log_filename)
    os.makedirs(os.path.dirname(log_path), exist_ok=True)  # 确保目录存在
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            # logging.StreamHandler(),  # 控制台
            logging.FileHandler(log_path, encoding="utf-8")  # 指定日志路径
        ]
    )
    ua = UserAgent()
    headers = {"user-agent":ua.random}
    if(os.path.exists(img_output_path)and not if_cover):
        logging.info(f"图片已存在: {img_output_path}")
        return
    # 下载图片（CDN 有频率限制，403/网络错误自动重试，间隔递增）
    import time
    headers = {"user-agent":ua.random, "referer":"https://tlidb.com/cn/"}
    max_retry = 5
    for attempt in range(max_retry):
        try:
            response = requests.get(img_url,headers=headers,timeout=30)
            if response.status_code == 200:
                filename = f"{img_output_path}"
                os.makedirs(os.path.dirname(filename), exist_ok=True)
                with open(filename, 'wb') as f:
                    f.write(response.content)
                logging.info(f"图片已保存: {os.path.abspath(filename)}")
                return
            elif response.status_code == 403 and attempt < max_retry - 1:
                logging.warning(f"下载被限流(403): {img_url} 第{attempt+1}次重试")
                time.sleep(3 * (attempt + 1))
                headers = {"user-agent":ua.random, "referer":"https://tlidb.com/cn/"}
                continue
            else:
                logging.error(f"下载失败: {img_url} 状态码 {response.status_code}")
                return
        except Exception as e:
            if attempt < max_retry - 1:
                logging.warning(f"下载异常({e}): {img_url} 第{attempt+1}次重试")
                time.sleep(3 * (attempt + 1))
                continue
            logging.error(f"下载失败: {img_url} 错误信息 {e}")
def save_json(data,path):
    import os
    import json
    if not os.path.exists(path):
        # 创建空 JSON 数据
        empty_data = {}
        # 确保父目录存在
        os.makedirs(os.path.dirname(path), exist_ok=True)
        # 写入空 JSON 文件
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(empty_data, f, ensure_ascii=False, indent=4)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
def replace_comma_to_br(bf4soup):
    for br in bf4soup.find_all('br'):
        br.replace_with(';')

