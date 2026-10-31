from typing import Any

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from app.store import (
    ProjectStoreError,
    delete_project,
    list_projects,
    read_project,
    write_project,
)


router = APIRouter(tags=["projects"])


@router.get("/projects")
async def get_projects() -> JSONResponse:
    return JSONResponse({"projects": list_projects()})


@router.get("/projects/{project_id}")
async def get_project(project_id: str) -> JSONResponse:
    try:
        document = read_project(project_id)
    except ProjectStoreError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})

    if document is None:
        return JSONResponse(status_code=404, content={"error": "没有找到这个项目存档"})
    return JSONResponse(document)


@router.put("/projects/{project_id}")
async def put_project(project_id: str, payload: Any = Body(...)) -> JSONResponse:
    try:
        document = write_project(project_id, payload)
    except ProjectStoreError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except OSError:
        return JSONResponse(
            status_code=500,
            content={"error": "写入项目存档失败，请检查目录权限"},
        )
    return JSONResponse(document)


@router.delete("/projects/{project_id}")
async def remove_project(project_id: str) -> JSONResponse:
    try:
        deleted = delete_project(project_id)
    except ProjectStoreError as exc:
        return JSONResponse(status_code=400, content={"error": str(exc)})
    except OSError:
        return JSONResponse(
            status_code=500,
            content={"error": "删除项目存档失败，请检查目录权限"},
        )

    if not deleted:
        return JSONResponse(status_code=404, content={"error": "没有找到这个项目存档"})
    return JSONResponse({"deleted": True, "id": project_id})
