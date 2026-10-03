import os
import queue
import subprocess
import sys
import threading

import ttkbootstrap as ttk
from ttkbootstrap.constants import BOTH, END, LEFT, RIGHT, X, YES

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON = sys.executable


def list_scripts():
    names = []
    for f in sorted(os.listdir(BASE_DIR)):
        if not f.endswith('.py'):
            continue
        if f.startswith('爬取') or f.startswith('得到'):
            names.append(f)
    return names


class SpiderGUI:
    def __init__(self):
        self.root = ttk.Window('TOB 爬虫管理器', themename='darkly', size=(980, 640))
        self.root.minsize(820, 500)

        self.msg_queue = queue.Queue()
        self.running = False
        self.stop_flag = threading.Event()
        self.procs = {}

        self.scripts = list_scripts()

        self._build_ui()
        self.root.after(100, self._poll_queue)
        self.root.protocol('WM_DELETE_WINDOW', self._on_close)

    def _build_ui(self):
        top = ttk.Frame(self.root, padding=(10, 8))
        top.pack(fill=X)
        self.info_label = ttk.Label(top, text=f'工作目录：{BASE_DIR}\n解释器：{PYTHON}', bootstyle='secondary')
        self.info_label.pack(side=LEFT)
        self.btn_run_all = ttk.Button(top, text='▶ 运行全部', command=self.run_all, bootstyle='success')
        self.btn_run_all.pack(side=RIGHT, padx=(6, 0))
        self.btn_run_sel = ttk.Button(top, text='▶ 运行选中', command=self.run_selected, bootstyle='primary')
        self.btn_run_sel.pack(side=RIGHT, padx=(6, 0))
        self.btn_stop = ttk.Button(top, text='■ 停止', command=self.stop_all, bootstyle='danger', state='disabled')
        self.btn_stop.pack(side=RIGHT, padx=(6, 0))

        body = ttk.Panedwindow(self.root, orient='horizontal')
        body.pack(fill=BOTH, expand=YES, padx=10, pady=(0, 10))

        left = ttk.Labelframe(body, text='脚本列表', padding=4)
        cols = ('name', 'status')
        self.tree = ttk.Treeview(left, columns=cols, show='headings', height=20)
        self.tree.heading('name', text='脚本')
        self.tree.heading('status', text='状态')
        self.tree.column('name', width=260, anchor='w')
        self.tree.column('status', width=110, anchor='center')
        self.tree.pack(fill=BOTH, expand=YES)
        for s in self.scripts:
            self.tree.insert('', END, iid=s, values=(s, '未运行'))
        body.add(left, weight=1)

        right = ttk.Labelframe(body, text='运行日志', padding=4)
        self.log = ttk.Text(right, state='disabled', wrap='word', font=('Consolas', 10))
        scroll = ttk.Scrollbar(right, orient='vertical', command=self.log.yview)
        self.log.configure(yscrollcommand=scroll.set)
        self.log.pack(side=LEFT, fill=BOTH, expand=YES)
        scroll.pack(side=RIGHT, fill='y')
        body.add(right, weight=1)

    def _log(self, text):
        self.log.configure(state='normal')
        self.log.insert(END, text)
        self.log.see(END)
        self.log.configure(state='disabled')

    def _set_status(self, script, status):
        if self.tree.exists(script):
            self.tree.set(script, 'status', status)

    def _set_btn_state(self, busy):
        self.btn_run_all.configure(state='disabled' if busy else 'normal')
        self.btn_run_sel.configure(state='disabled' if busy else 'normal')
        self.btn_stop.configure(state='normal' if busy else 'disabled')

    def run_all(self):
        self._enqueue(self.scripts)

    def run_selected(self):
        sel = self.tree.selection()
        if not sel:
            self._log('请先在左侧勾选（Ctrl/Shift 多选）要运行的脚本\n')
            return
        self._enqueue(list(sel))

    def stop_all(self):
        self.stop_flag.set()
        self._log('\n=== 停止信号已发送，等待当前脚本退出 ===\n')
        for p in self.procs.values():
            try:
                p.terminate()
            except Exception:
                pass

    def _enqueue(self, scripts):
        if self.running:
            self._log('已有任务在执行，请等待完成或点击停止\n')
            return
        self.running = True
        self.stop_flag.clear()
        self._set_btn_state(True)
        threading.Thread(target=self._worker, args=(scripts,), daemon=True).start()

    def _worker(self, scripts):
        for i, script in enumerate(scripts, 1):
            if self.stop_flag.is_set():
                break
            self.msg_queue.put(('header', f'\n[{i}/{len(scripts)}] ▶ 开始运行 {script}\n'))
            self.msg_queue.put(('status', script, '运行中…'))
            code = self._run_script(script)
            if self.stop_flag.is_set() and code is None:
                self.msg_queue.put(('status', script, '已停止'))
                break
            if code == 0:
                self.msg_queue.put(('status', script, '✔ 成功'))
                self.msg_queue.put(('log', f'✅ {script} 执行成功（exit 0）\n'))
            else:
                self.msg_queue.put(('status', script, '✘ 失败'))
                self.msg_queue.put(('log', f'❌ {script} 执行失败（exit {code}）\n'))
        self.msg_queue.put(('log', '\n=== 全部任务结束 ===\n'))
        self.msg_queue.put(('done', None, None))

    def _run_script(self, script):
        path = os.path.join(BASE_DIR, script)
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUNBUFFERED'] = '1'
        try:
            p = subprocess.Popen(
                [PYTHON, path],
                cwd=BASE_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1,
                env=env,
            )
        except Exception as e:
            self.msg_queue.put(('log', f'❌ 无法启动 {script}: {e}\n'))
            return -1
        self.procs[script] = p
        for line in p.stdout:
            if self.stop_flag.is_set():
                break
            self.msg_queue.put(('log', line))
        p.stdout.close()
        code = p.wait()
        self.procs.pop(script, None)
        return code

    def _poll_queue(self):
        try:
            while True:
                item = self.msg_queue.get_nowait()
                kind = item[0]
                if kind == 'log':
                    self._log(item[1])
                elif kind == 'status':
                    self._set_status(item[1], item[2])
                elif kind == 'header':
                    self._log(item[1])
                elif kind == 'done':
                    self.running = False
                    self._set_btn_state(False)
        except queue.Empty:
            pass
        self.root.after(100, self._poll_queue)

    def _on_close(self):
        if self.running:
            self.stop_flag.set()
        self.root.destroy()


if __name__ == '__main__':
    app = SpiderGUI()
    app.root.mainloop()
