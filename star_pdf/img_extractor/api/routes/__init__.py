"""
API路由模块
包含所有API路由的注册和配置
"""

from fastapi import FastAPI
import logging

from api.routes import status_routes, process_routes, file_routes, task_routes, batch_routes
from api.routes import upload_routes_fastapi
from api.core.server_core import ServerCore

logger = logging.getLogger("ApiRoutes")

def register_routes(app: FastAPI, server_core: ServerCore) -> None:
    """
    注册所有路由到FastAPI应用

    参数:
        app: FastAPI应用实例
        server_core: 服务器核心实例
    """
    # 调用每个路由模块的setup_routes函数
    status_routes.setup_routes(app, server_core)
    process_routes.setup_routes(app, server_core)
    file_routes.setup_routes(app, server_core)
    task_routes.setup_routes(app, server_core)
    batch_routes.setup_routes(app, server_core)
    upload_routes_fastapi.setup_routes(app, server_core)

    # 添加API前缀
    app.include_router(status_routes.router, prefix="/api")
    app.include_router(process_routes.router, prefix="/api")
    app.include_router(file_routes.router, prefix="/api")
    app.include_router(task_routes.router, prefix="/api")
    app.include_router(batch_routes.router, prefix="/api")
    app.include_router(upload_routes_fastapi.router, prefix="/api")

    logger.info("所有API路由已注册")

# 为了兼容旧代码，提供别名
register_all_routes = register_routes