# 专利文献处理API

本项目提供了一套API，用于处理专利文献中的化学结构和反应图像识别，支持远程服务部署和多设备并行处理。

## 目录

- [系统概述](#系统概述)
- [服务器端](#服务器端)
  - [功能特点](#功能特点)
  - [安装和配置](#安装和配置)
  - [启动服务器](#启动服务器)
  - [API端点](#api端点)
- [客户端](#客户端)
  - [安装依赖](#客户端安装依赖)
  - [命令行使用](#命令行使用)
  - [代码集成](#代码集成)
- [连接模式](#连接模式)
  - [本地模式](#本地模式)
  - [远程模式](#远程模式)
- [使用示例](#使用示例)
- [性能优化](#性能优化)
- [故障排除](#故障排除)

## 系统概述

系统由两个主要组件构成：

1. **服务器API** (`server.py`)：部署在GPU服务器上，提供文献处理服务
2. **客户端API** (`client.py`)：在用户机器上运行，向服务器发送处理请求

服务器使用多进程、多设备架构，能够自动分配任务和平衡负载，提供高效的专利图像处理服务。

## 服务器端

### 功能特点

- **多GPU支持**：自动检测所有可用GPU，或手动指定使用特定GPU
- **多进程处理**：每个GPU可配置多个工作进程，最大化并行处理能力
- **模型预加载**：服务器启动时预加载模型，减少请求响应时间
- **资源复用**：进程内复用模型实例，减少内存消耗
- **负载均衡**：根据设备负载情况自动分配任务
- **独立处理环境**：每个请求使用独立的`ResultManager`，避免结果混淆

### 安装和配置

1. 安装依赖：

```bash
pip install flask torch multiprocessing waitress
```

2. 服务器系统要求：
   - 推荐配置：多GPU服务器，每个GPU至少8GB显存
   - 最低配置：单GPU服务器或高性能CPU
   - 内存：至少16GB
   - 存储：SSD推荐，用于快速文件读写

### 启动服务器

服务器支持多种启动配置：

**使用所有可用GPU**：

```bash
python server.py
```

**指定使用特定GPU**：

```bash
# 使用ID为0和2的GPU
python server.py --devices 0 2

# 仅使用ID为1的GPU
python server.py --devices 1
```

**自定义端口和进程数**：

```bash
# 指定端口7890，每个GPU启动3个进程
python server.py --port 7890 --procs 3
```

**启动参数说明**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--devices` | 要使用的GPU设备ID列表 | 全部可用GPU |
| `--port` | 服务器端口号 | 7878 |
| `--procs` | 每个设备的进程数 | 2 |

### API端点

服务器提供以下API端点：

1. **GET /status**
   - 获取服务器状态、可用设备和资源使用情况

2. **POST /process_patent**
   - 处理单个专利目录
   - 参数：
     ```json
     {
       "patent_dir": "/path/to/patent",
       "device_id": 0,  // 可选
       "remote_mode": false  // 可选
     }
     ```

3. **POST /process_batch**
   - 批量处理多个专利目录
   - 参数：
     ```json
     {
       "input_dirs": ["/path/to/patent1", "/path/to/patent2"],
       "output_root": "/path/to/output",  // 可选
       "remote_mode": false  // 可选
     }
     ```

4. **POST /upload_and_process**
   - 上传并处理专利文件夹
   - 支持文件上传或远程路径

## 客户端

### 客户端安装依赖

```bash
pip install requests tqdm
```

### 命令行使用

客户端支持多种命令行操作模式：

**处理单个专利**：

```bash
# 自动选择设备
python client.py --server http://server-address:7878 patent --dir /path/to/patent

# 指定设备
python client.py --server http://server-address:7878 patent --dir /path/to/patent --device 0
```

**批量处理专利**：

```bash
python client.py --server http://server-address:7878 batch --input /path/to/patents --output /path/to/output
```

**上传并处理专利**：

```bash
python client.py --server http://server-address:7878 upload --dir /path/to/patent
```

### 代码集成

可以将客户端API集成到您的Python应用中：

```python
from client import PatentAPIClient

# 创建客户端实例
client = PatentAPIClient(server_url="http://server-address:7878")

# 处理单个专利
result = client.process_patent("/path/to/patent")
print(result)

# 批量处理
result = client.process_batch("/path/to/patents", output_root="/path/to/output")
print(f"处理完成: {result['processed']} 成功, {result['failed']} 失败")
```

## 连接模式

系统支持两种连接模式：本地模式和远程模式。

### 本地模式

本地模式适用于客户端和服务器在同一台机器上运行，或客户端可以直接访问服务器上的文件系统（如通过网络共享）。

特点：
- 客户端需要访问处理文件的完整路径
- 路径验证在客户端和服务器端都进行

### 远程模式

远程模式适用于客户端和服务器在不同机器上运行，且客户端无法直接访问服务器文件系统的情况。

启用方法：添加`--remote`参数

```bash
# 远程模式处理单个专利
python client.py --server http://server-address:7878 --remote patent --dir /path/on/server/patent

# 远程模式批量处理
python client.py --server http://server-address:7878 --remote batch --input /path/on/server/patents
```

在代码中启用远程模式：

```python
client = PatentAPIClient(server_url="http://server-address:7878", remote_mode=True)
```

特点：
- 路径指向服务器上的文件位置
- 客户端不验证路径是否存在
- 服务器负责验证和处理文件路径

## 使用示例

### 本地服务器处理

```bash
# 服务器端（使用所有GPU）
python server.py

# 客户端处理单个专利
python client.py patent --dir E:\CQU\Fourth_year\thesis\start_pdf_gui\retro_extractor\data\drug_CN_100\CN102942613
```

### 远程服务器处理

```bash
# 服务器端（仅使用GPU 0和1）
python server.py --devices 0 1

# 客户端远程处理Linux服务器上的文件
python client.py --server http://172.19.1.81:7878 --remote patent --dir /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN106256824 --device 0
```

## 性能优化

1. **GPU选择**：
   - 对于大量处理任务，使用所有可用GPU
   - 对于特定任务，可以选择性能更好的特定GPU
   - 高优先级任务可以单独分配GPU，避免资源竞争

2. **进程数调优**：
   - GPU显存充足：每个GPU 2-3个进程
   - GPU显存有限：每个GPU 1个进程
   - CPU模式：可以设置更多进程（取决于CPU核心数）

3. **服务器资源管理**：
   - 定期清理缓存：系统自动每30分钟清理一次缓存
   - 并发任务数控制：避免过多任务导致资源耗尽

## 故障排除

| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 连接失败 | 服务器未运行或网络问题 | 检查服务器状态和网络连接 |
| CUDA内存不足 | GPU显存不足 | 减少每个GPU的进程数或使用`--devices`指定更多GPU |
| 路径错误 | 路径格式不兼容或权限问题 | 检查路径格式，确保与服务器系统兼容 |
| 处理超时 | 任务过于复杂或服务器负载过高 | 增加超时阈值或减少并发任务数 |
| 远程模式失败 | 服务器上找不到路径 | 确认路径在服务器上存在且有正确权限 |
