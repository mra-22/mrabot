import sys
import json
from datetime import datetime

from PyQt6.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLineEdit, QTextEdit, QLabel,
    QGroupBox, QProgressBar, QTableWidget,
    QTableWidgetItem, QHeaderView
)

from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont


ADMIN_USER = "admin"
ADMIN_PASS = "admin123"

LOG_FILE = "bot.log"
STATUS_FILE = "bot_status.txt"
COMMAND_QUEUE = "command_queue.txt"
STATS_FILE = "bot_stats.json"
GROUP_FILE = "group_list.json"
PROGRESS_FILE = "broadcast_progress.json"


class LoginWindow(QWidget):

    def __init__(self):
        super().__init__()

        self.setWindowTitle("MR.A BOT CONTROL CENTER LOGIN")
        self.setGeometry(500,250,350,180)

        layout = QVBoxLayout()

        title = QLabel("MR.A BOT CONTROL CENTER")
        title.setFont(QFont("Consolas",16))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.user = QLineEdit()
        self.user.setPlaceholderText("Username")

        self.pw = QLineEdit()
        self.pw.setPlaceholderText("Password")
        self.pw.setEchoMode(QLineEdit.EchoMode.Password)

        self.status = QLabel("")

        btn = QPushButton("Login")
        btn.clicked.connect(self.login)

        layout.addWidget(title)
        layout.addWidget(self.user)
        layout.addWidget(self.pw)
        layout.addWidget(self.status)
        layout.addWidget(btn)

        self.setLayout(layout)

    def login(self):

        if self.user.text()==ADMIN_USER and self.pw.text()==ADMIN_PASS:

            self.dashboard = ControlCenter()
            self.dashboard.show()
            self.close()

        else:
            self.status.setText("Login gagal")


class ControlCenter(QWidget):

    def __init__(self):
        super().__init__()

        self.setWindowTitle("MR.A BOT CONTROL CENTER")
        self.setGeometry(100,50,1300,720)

        main = QHBoxLayout()

        # LEFT PANEL

        left = QVBoxLayout()

        title = QLabel("BOT CONTROL")
        title.setFont(QFont("Consolas",14))

        left.addWidget(title)

        btn_start = QPushButton("Start Bot")
        btn_start.clicked.connect(lambda:self.send_cmd("!startbot"))

        btn_stop = QPushButton("Stop Bot")
        btn_stop.clicked.connect(lambda:self.send_cmd("!stopbot"))

        btn_refresh = QPushButton("Refresh Groups")
        btn_refresh.clicked.connect(self.load_groups)

        left.addWidget(btn_start)
        left.addWidget(btn_stop)
        left.addWidget(btn_refresh)

        search_box = QLineEdit()
        search_box.setPlaceholderText("Search group...")
        search_box.textChanged.connect(self.search_group)

        left.addWidget(search_box)

        self.group_table = QTableWidget()
        self.group_table.setColumnCount(2)
        self.group_table.setHorizontalHeaderLabels(["Group Name","Members"])

        self.group_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)

        left.addWidget(self.group_table)

        main.addLayout(left,4)

        # RIGHT PANEL

        right = QVBoxLayout()

        self.stats = QLabel("Groups: 0 | Users: 0")
        right.addWidget(self.stats)

        self.time = QLabel("Server Time: -")
        right.addWidget(self.time)

        bc_box = QGroupBox("Broadcast")

        bc_layout = QVBoxLayout()

        self.broadcast_input = QLineEdit()
        self.broadcast_input.setPlaceholderText("Pesan broadcast")

        btn_bc = QPushButton("Send Broadcast")
        btn_bc.clicked.connect(self.broadcast)

        btn_stop_bc = QPushButton("Stop Broadcast")
        btn_stop_bc.clicked.connect(self.stop_broadcast)

        bc_layout.addWidget(self.broadcast_input)
        bc_layout.addWidget(btn_bc)
        bc_layout.addWidget(btn_stop_bc)

        bc_box.setLayout(bc_layout)

        right.addWidget(bc_box)

        self.progress = QProgressBar()
        self.progress_label = QLabel("Progress: 0%")

        right.addWidget(self.progress)
        right.addWidget(self.progress_label)

        log_box = QGroupBox("Bot Logs")

        log_layout = QVBoxLayout()

        self.logs = QTextEdit()
        self.logs.setReadOnly(True)

        log_layout.addWidget(self.logs)

        log_box.setLayout(log_layout)

        right.addWidget(log_box)

        self.status = QLabel("Bot Status: Offline")

        right.addWidget(self.status)

        main.addLayout(right,6)

        self.setLayout(main)

        self.groups_cache = []

        self.timer = QTimer()
        self.timer.timeout.connect(self.update_dashboard)
        self.timer.start(1000)

        self.load_groups()


    def send_cmd(self,cmd):

        with open(COMMAND_QUEUE,"a") as f:
            f.write(cmd+"\n")

        self.logs.append("[ADMIN] "+cmd)


    def broadcast(self):

        msg = self.broadcast_input.text().strip()

        if not msg:
            return

        cmd = f"!broadcast|{msg}"

        with open(COMMAND_QUEUE,"a") as f:
            f.write(cmd+"\n")

        self.logs.append("[BROADCAST] "+msg)

        self.broadcast_input.clear()


    def load_groups(self):

        try:

            with open(GROUP_FILE) as f:

                groups = json.load(f)

                self.groups_cache = groups

                self.render_groups(groups)

        except:
            pass


    def render_groups(self,groups):

        self.group_table.setRowCount(len(groups))

        for i,g in enumerate(groups):

            self.group_table.setItem(i,0,QTableWidgetItem(g["name"]))
            self.group_table.setItem(i,1,QTableWidgetItem(str(g["size"])))


    def search_group(self,text):

        text = text.lower()

        filtered = []

        for g in self.groups_cache:

            if text in g["name"].lower():
                filtered.append(g)

        self.render_groups(filtered)
    def stop_broadcast(self):

        cmd = "!stopbroadcast"

        with open(COMMAND_QUEUE,"a") as f:
            f.write(cmd+"\n")

        self.logs.append("[ADMIN] Stop Broadcast")

    def update_dashboard(self):

        now = datetime.now().strftime("%H:%M:%S")

        self.time.setText("Server Time: "+now)

        try:

            with open(LOG_FILE,"r",encoding="utf-8",errors="replace") as f:

                lines = f.readlines()[-20:]

                self.logs.setText("".join(lines))

        except:
            pass


        try:

            with open(STATS_FILE) as f:

                data = json.load(f)

                self.stats.setText(
                    f"Groups: {data['groups']} | Users: {data['users']}"
                )

        except:
            pass


        try:

            with open(PROGRESS_FILE) as f:

                data = json.load(f)

                total = data["total"]
                sent = data["sent"]

                if total>0:

                    percent = int((sent/total)*100)

                    self.progress.setValue(percent)

                    self.progress_label.setText(
                        f"{percent}% ({sent}/{total})"
                    )

        except:
            pass


        try:

            with open(STATUS_FILE) as f:

                status = f.read().strip()

                if status=="RUNNING":
                    self.status.setText("Bot Status: RUNNING")
                else:
                    self.status.setText("Bot Status: STOPPED")

        except:
            pass


if __name__ == "__main__":

    app = QApplication(sys.argv)

    login = LoginWindow()
    login.show()

    sys.exit(app.exec())