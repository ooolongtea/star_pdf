# 分子结构处理 API 系统

## 目录

- [用户手册](#用户手册)
  - [项目概述](#项目概述)
  - [系统架构](#系统架构)
  - [环境设置](#环境设置)
  - [系统启动](#系统启动)
  - [命令行操作](#命令行操作)
  - [工作模式](#工作模式)
  - [跨平台使用](#跨平台使用)
  - [高级配置](#高级配置)
  - [常见问题](#常见问题)
- [API接口文档](#api接口文档)
  - [服务器状态](#服务器状态)
  - [专利处理](#专利处理)
  - [批量处理](#批量处理)
  - [文件上传](#文件上传)
  - [下载结果](#下载结果)
  - [目录列表](#目录列表)

## 用户手册

### 项目概述

本系统是专利文档中分子结构图像处理的API服务，能自动识别分子结构、反应图式和分子共指关系。支持多GPU并行处理，适用于大规模专利数据批量处理。

### 系统架构

**服务器端组件：**
- 核心模块：服务器初始化、进程池管理和设备分配
- API路由：处理文件上传、专利处理和状态查询
- 处理器模块：实现分子识别和共指消解
- 工具模块：提供文件操作和结果管理功能

**客户端组件：**
- 客户端核心：与服务器通信
- 命令行接口：提供用户交互界面
- 处理客户端：处理请求和本地结果保存

### 环境设置

**系统要求：**

- Python 3.8+
- CUDA 11.0+ (如果使用GPU)
- 至少16GB内存
- 对于大规模处理，推荐使用多个GPU

**安装依赖：**

```bash
# 创建虚拟环境
conda create -n img_extractor python=3.8
conda activate img_extractor

# 安装依赖
pip install -r requirements.txt
```

### 系统启动

**启动服务器：**

```bash
# 基本启动方式
python run_api_server.py --host 0.0.0.0 --port 7878 --gpu-devices 0,1 --processes 2

# 在高性能服务器上启动多GPU处理
python run_api_server.py --host 0.0.0.0 --port 8080 --gpu-devices 0,1,2,3 --processes 2 --data-dir /home/zhangxiaohong/zhouxingyu/patent_data

# 启动示例（对应连接URL: http://172.19.1.81:8080）
python run_api_server.py --host 0.0.0.0 --port 8080 --gpu-devices 0,1 --processes 2
```

**启动客户端：**
```bash
python run_api_client.py
```

**服务器认证信息：**
```
服务器主机: http://172.19.1.81:8080
用户名: zhouxingyu
密码: zxy123456
```
注意：客户端已配置默认使用上述认证信息，无需手动指定。

### 命令行操作

**测试服务器连接状态：**
```bash
# 使用状态命令测试连接（使用默认认证信息）
python run_api_client.py status

# 远程模式下测试连接（使用默认连接地址和认证信息）
python run_api_client.py --remote status

# 指定服务器地址和认证信息测试连接
python run_api_client.py --server http://172.19.1.81:8080 --username zhouxingyu --password zxy123456 status
```

**连接远程服务器：**
```bash
# 默认连接到http://172.19.1.81:8080
python run_api_client.py --remote status

# 指定服务器地址
python run_api_client.py --server http://172.19.1.81:8080 --remote status
```

**处理单个专利：**
```bash
python run_api_client.py process /path/to/patent --device 0 --wait
# 远程模式 指定处理文件
python run_api_client.py --remote process /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output/CN104230815
```

**批量处理专利：**
```bash
python run_api_client.py batch /path/to/patents_dir --output-dir /path/to/output --wait
python run_api_client.py --remote batch /home/zhangxiaohong/zhouxingyu/zxy_extractor/data/temp_output --wait
```

**上传并处理：**
```bash
python run_api_client.py upload /path/to/patent
```

**上传并批处理：**
```bash
python run_api_client.py upload-batch /path/to/patents_dir
```

### 工作模式

**远程模式：** 使用 `--remote` 参数，文件位于服务器上，客户端只发送路径。

**本地模式：** 默认模式，文件位于客户端本地，结果保存到本地。

### 跨平台使用

服务器适合在Linux（GPU服务器）上运行，客户端可在Windows上运行。跨平台使用时注意路径格式：
- 服务器路径使用Linux格式：`/home/user/patents`
- 客户端路径可使用Windows格式：`C:\Users\user\patents`

### 高级配置

**服务器资源配置：**
- `--devices`：指定GPU设备ID
- `--procs`：每个设备的工作进程数
- `--port`：指定服务器端口

**客户端配置：**
- `--server`：指定服务器URL
- `--wait`：等待处理完成
- `--output-dir`：指定输出目录
- `--username`：指定服务器用户名（默认为"zhouxingyu"）
- `--password`：指定服务器密码（默认为"zxy123456"）

### 常见问题

**内存不足：**
- 减少每个设备的进程数
- 调整批处理大小

**GPU显存不足：**
- 使用 `--procs 1` 减少并行处理
- 手动清理GPU缓存

**路径问题：**
- 远程模式：确保使用服务器上的正确路径
- 避免路径中的特殊字符

## API接口文档

### 服务器状态

获取服务器状态信息

**请求：** `GET /status`

**响应：**
```json
{
  "status": "running",
  "devices": ["cuda:0", "cuda:1"],
  "process_pools": ["cuda:0_0", "cuda:0_1", "cuda:1_0", "cuda:1_1"],
  "task_counts": {"cuda:0": 0, "cuda:1": 1},
  "gpu_memory": {"gpu_0": {"allocated_gb": "0.65", "reserved_gb": "0.89"}}
}
```

### 专利处理

处理单个专利目录

**请求：** `POST /process_patent`

**请求体：**
```json
{
  "patent_dir": "/path/to/patent",
  "device_id": 0,           // 可选
  "remote_mode": false      // 可选
}
```

**响应：**
```json
{
  "success": true,
  "patent_dir": "/path/to/patent",
  "processing_time": 45.2,
  "output_dir": "/path/to/patent",
  "excel_file": "/path/to/patent/patent_chemicals.xlsx"
}
```

### 批量处理

批量处理多个专利目录

**请求：** `POST /process_batch`

**请求体：**
```json
{
  "input_dirs": ["/path/to/patent1", "/path/to/patent2"],
  "output_root": "/path/to/output",  // 可选
  "remote_mode": false               // 可选
}
```

**响应：**
```json
{
  "success": true,
  "processed": 5,
  "failed": 0,
  "results": [
    {
      "patent_dir": "/path/to/patent1",
      "output_dir": "/path/to/patent1",
      "excel_file": "/path/to/patent1/patent1_chemicals.xlsx"
    }
  ],
  "failures": []
}
```

### 文件上传

上传并处理文件

**请求：** `POST /upload_and_process`

**表单数据模式：**
```
Content-Type: multipart/form-data

patent_folder: <文件>
batch_mode: true|false      // 可选，默认false
```

**JSON模式（远程）：**
```json
{
  "remote_mode": true,
  "patent_dir": "/path/to/patent",  // 单个处理
  "path": "/path/to/patents",       // 批处理
  "batch_mode": true
}
```

**响应：**
与专利处理或批量处理接口响应相同

### 下载结果

下载处理结果文件

**请求：** `GET /download?file=/path/to/file.xlsx`

**响应：**
文件内容（二进制）

### 目录列表

列出目录中的文件

**请求：** `GET /list_files?dir=/path/to/directory`

**响应：**
```json
{
  "success": true,
  "files": [
    {
      "path": "/path/to/directory/file1.json",
      "name": "file1.json",
      "size": 1024,
      "type": "json"
    }
  ]
}
```

## 开发者指南

### 代码结构

```
img_extractor/
├── api/                    # API服务器代码
│   ├── core/               # 核心功能模块
│   │   ├── server_core.py  # 服务器核心
│   │   ├── worker.py       # 工作进程
│   │   └── patent_task.py  # 专利处理任务
│   ├── routes/             # API路由
│   │   ├── process_routes.py  # 处理路由
│   │   ├── status_routes.py   # 状态路由
│   │   ├── file_routes.py     # 文件路由
│   │   └── task_routes.py     # 任务路由
│   ├── processors/         # 处理器模块
│   │   ├── patent_processor.py   # 专利处理器
│   │   └── molcoref_processor.py # 分子共指处理器
│   ├── utils/              # 工具函数
│   ├── client/             # 客户端代码
│   │   ├── cli.py          # 命令行接口
│   │   ├── client_core.py  # 客户端核心
│   │   └── process_client.py # 处理客户端
│   └── server_main.py      # 服务器主程序
├── run_api_server.py       # 服务器启动脚本
└── run_api_client.py       # 客户端启动脚本
```

### 添加新功能

#### 添加新的处理器

1. 在 `api/processors` 目录下创建新的处理器类
2. 实现 `process` 方法
3. 在 `patent_processor.py` 中注册新处理器

```python
class NewProcessor:
    def __init__(self, device="cpu"):
        self.device = device
        # 初始化模型和资源

    def process(self, input_data):
        # 实现处理逻辑
        return result
```

#### 添加新的API路由

1. 在 `api/routes` 目录下创建新的路由文件
2. 定义路由函数和端点
3. 在 `__init__.py` 中注册新路由

```python
from fastapi import APIRouter

router = APIRouter()
server_core = None

@router.get("/new_endpoint")
async def new_endpoint():
    # 实现端点逻辑
    return {"message": "新端点"}

def setup_routes(app, _server_core):
    global server_core
    server_core = _server_core
    app.include_router(router, tags=["新功能"])
```

### 错误处理

服务器使用以下方式处理错误：

1. **API层错误**：使用FastAPI的HTTPException
2. **处理层错误**：捕获异常并返回错误信息
3. **工作进程错误**：记录错误并重试

示例：
```python
try:
    result = process_function()
    return result
except Exception as e:
    logger.error(f"处理失败: {str(e)}")
    raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")
```

### 性能优化

1. **GPU内存管理**：
   - 使用 `torch.cuda.empty_cache()` 清理GPU缓存
   - 控制批处理大小避免OOM错误

2. **进程池优化**：
   - 根据GPU显存大小调整每个设备的进程数
   - 对于大模型，每个GPU使用1个进程
   - 对于小模型，每个GPU可使用多个进程

3. **负载均衡**：
   - 使用轮询方式分配任务
   - 监控设备负载，优先分配给低负载设备
