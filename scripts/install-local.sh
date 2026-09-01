#!/usr/bin/env bash

set -euo pipefail

readonly EXPECTED_PRODUCT_NAME="LeetCode Draw"
readonly EXPECTED_BUNDLE_ID="com.leetcode-draw.desktop"
readonly EXPECTED_VERSION="1.2.2"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SOURCE_APP="${PROJECT_ROOT}/release/mac-arm64/${EXPECTED_PRODUCT_NAME}.app"
readonly TARGET_APP="/Applications/${EXPECTED_PRODUCT_NAME}.app"
readonly NEXT_APP="/Applications/${EXPECTED_PRODUCT_NAME}.app.next"
readonly BACKUP_DIR="${PROJECT_ROOT}/release/install-backups"
readonly ARCHIVE_DIR="${PROJECT_ROOT}/release/archive"
readonly RUN_STAMP="$(date '+%Y%m%d-%H%M%S')-$$"
readonly BACKUP_APP="${BACKUP_DIR}/${EXPECTED_PRODUCT_NAME}-${RUN_STAMP}.appbackup.noindex"
readonly ARCHIVE_APP="${ARCHIVE_DIR}/${EXPECTED_PRODUCT_NAME}-${EXPECTED_VERSION}-${RUN_STAMP}.appbackup.noindex"
readonly FAILED_APP="${ARCHIVE_DIR}/${EXPECTED_PRODUCT_NAME}-failed-${RUN_STAMP}.appbackup.noindex"
readonly LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

backup_made=0
installed_new=0

fail() {
  printf '安装中止：%s\n' "$1" >&2
  exit 1
}

plist_value() {
  local app_path="$1"
  local key="$2"
  plutil -extract "$key" raw -o - "${app_path}/Contents/Info.plist"
}

verify_candidate() {
  local app_path="$1"
  local label="$2"
  local bundle_id
  local version

  [[ -d "$app_path" ]] || fail "${label}不存在：${app_path}"
  [[ ! -L "$app_path" ]] || fail "${label}不能是符号链接：${app_path}"
  [[ -f "${app_path}/Contents/Info.plist" ]] || fail "${label}缺少 Info.plist"
  [[ -x "${app_path}/Contents/MacOS/${EXPECTED_PRODUCT_NAME}" ]] || fail "${label}缺少可执行文件"

  bundle_id="$(plist_value "$app_path" CFBundleIdentifier)"
  version="$(plist_value "$app_path" CFBundleShortVersionString)"
  [[ "$bundle_id" == "$EXPECTED_BUNDLE_ID" ]] || fail "${label} Bundle ID 不匹配：${bundle_id}"
  [[ "$version" == "$EXPECTED_VERSION" ]] || fail "${label}版本不是 ${EXPECTED_VERSION}：${version}"
  codesign --verify --deep --strict "$app_path"
}

seal_helper_bundle() {
  local source_path="$1"
  local sealed_path="$2"

  [[ -d "$source_path" ]] || return 0
  [[ ! -e "$sealed_path" ]] || return 1
  [[ -d "${source_path}/Contents" ]] || return 1
  [[ ! -e "${source_path}/.BundleContents" ]] || return 1

  mv "${source_path}/Contents" "${source_path}/.BundleContents" || return 1
  mv "$source_path" "$sealed_path" || return 1
}

seal_backup_for_search() {
  local app_path="$1"
  local contents_path="${app_path}/Contents"
  local sealed_contents_path="${app_path}/.BundleContents"
  local frameworks_path="${contents_path}/Frameworks"
  local executable_path="${contents_path}/MacOS/${EXPECTED_PRODUCT_NAME}"

  [[ -d "$app_path" ]] || return 0
  [[ -d "$contents_path" ]] || return 1
  [[ ! -e "$sealed_contents_path" ]] || return 1

  if [[ -e "$executable_path" ]]; then
    [[ ! -e "${contents_path}/MacOS/.app-binary" ]] || return 1
    mv "$executable_path" "${contents_path}/MacOS/.app-binary" || return 1
  fi

  seal_helper_bundle "${frameworks_path}/${EXPECTED_PRODUCT_NAME} Helper.app" "${frameworks_path}/.helper" || return 1
  seal_helper_bundle "${frameworks_path}/${EXPECTED_PRODUCT_NAME} Helper (GPU).app" "${frameworks_path}/.helper-gpu" || return 1
  seal_helper_bundle "${frameworks_path}/${EXPECTED_PRODUCT_NAME} Helper (Plugin).app" "${frameworks_path}/.helper-plugin" || return 1
  seal_helper_bundle "${frameworks_path}/${EXPECTED_PRODUCT_NAME} Helper (Renderer).app" "${frameworks_path}/.helper-renderer" || return 1
  mv "$contents_path" "$sealed_contents_path" || return 1
}

rollback() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ $exit_code -ne 0 ]]; then
    printf '安装未完成，正在恢复原应用。\n' >&2

    if [[ $installed_new -eq 1 && -d "$TARGET_APP" ]]; then
      if ! mv "$TARGET_APP" "$FAILED_APP"; then
        printf '无法归档失败的新应用：%s\n' "$TARGET_APP" >&2
      fi
    fi

    if [[ $backup_made -eq 1 && -d "$BACKUP_APP" && ! -e "$TARGET_APP" ]]; then
      if mv "$BACKUP_APP" "$TARGET_APP"; then
        "$LSREGISTER" -f "$TARGET_APP" >/dev/null 2>&1 || true
        printf '已恢复：%s\n' "$TARGET_APP" >&2
      else
        printf '自动恢复失败，原应用仍保存在：%s\n' "$BACKUP_APP" >&2
      fi
    fi

    if [[ -d "$NEXT_APP" ]]; then
      if ! mv "$NEXT_APP" "${ARCHIVE_DIR}/${EXPECTED_PRODUCT_NAME}-next-${RUN_STAMP}.appbackup.noindex"; then
        printf '临时安装包仍保存在：%s\n' "$NEXT_APP" >&2
      fi
    fi
  fi

  exit "$exit_code"
}

trap rollback EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

[[ "$(uname -s)" == "Darwin" ]] || fail "本安装脚本仅支持 macOS"
[[ ! -e "$NEXT_APP" ]] || fail "发现未处理的临时应用，请先核对：${NEXT_APP}"
[[ ! -e "$BACKUP_APP" ]] || fail "备份目标已存在：${BACKUP_APP}"
[[ ! -e "$ARCHIVE_APP" ]] || fail "归档目标已存在：${ARCHIVE_APP}"

verify_candidate "$SOURCE_APP" "待安装应用"

if [[ -e "$TARGET_APP" ]]; then
  [[ -d "$TARGET_APP" && ! -L "$TARGET_APP" ]] || fail "现有安装路径不是普通应用目录：${TARGET_APP}"
  [[ "$(plist_value "$TARGET_APP" CFBundleIdentifier)" == "$EXPECTED_BUNDLE_ID" ]] || fail "现有应用 Bundle ID 不匹配，拒绝覆盖"
fi

mkdir -p "$BACKUP_DIR" "$ARCHIVE_DIR"

if pgrep -x "$EXPECTED_PRODUCT_NAME" >/dev/null 2>&1; then
  osascript -e 'tell application "LeetCode Draw" to quit' >/dev/null 2>&1 || true
  for _ in {1..20}; do
    pgrep -x "$EXPECTED_PRODUCT_NAME" >/dev/null 2>&1 || break
    sleep 0.25
  done
  pgrep -x "$EXPECTED_PRODUCT_NAME" >/dev/null 2>&1 && fail "LeetCode Draw 仍在运行，请退出应用后重试"
fi

ditto "$SOURCE_APP" "$NEXT_APP"
verify_candidate "$NEXT_APP" "安装暂存应用"

if [[ -d "$TARGET_APP" ]]; then
  mv "$TARGET_APP" "$BACKUP_APP"
  backup_made=1
fi

mv "$NEXT_APP" "$TARGET_APP"
installed_new=1
verify_candidate "$TARGET_APP" "已安装应用"

"$LSREGISTER" -u "$SOURCE_APP" >/dev/null 2>&1 || true
if [[ $backup_made -eq 1 ]]; then
  "$LSREGISTER" -u "$BACKUP_APP" >/dev/null 2>&1 || true
fi
"$LSREGISTER" -f "$TARGET_APP" >/dev/null 2>&1
mdimport "$TARGET_APP" >/dev/null 2>&1 || true
mv "$SOURCE_APP" "$ARCHIVE_APP"
trap - EXIT INT TERM

if [[ $backup_made -eq 1 ]]; then
  if ! seal_backup_for_search "$BACKUP_APP"; then
    printf '警告：旧版本备份未能完全隐藏，可能仍出现在启动台搜索中：%s\n' "$BACKUP_APP" >&2
  fi
fi
if ! seal_backup_for_search "$ARCHIVE_APP"; then
  printf '警告：构建候选归档未能完全隐藏，可能仍出现在启动台搜索中：%s\n' "$ARCHIVE_APP" >&2
fi

sleep 1
"$LSREGISTER" -u "$ARCHIVE_APP" >/dev/null 2>&1 || true
if [[ $backup_made -eq 1 ]]; then
  "$LSREGISTER" -u "$BACKUP_APP" >/dev/null 2>&1 || true
fi

printf '已安装：%s\n' "$TARGET_APP"
printf '版本：%s\n' "$(plist_value "$TARGET_APP" CFBundleShortVersionString)"
printf 'Bundle ID：%s\n' "$(plist_value "$TARGET_APP" CFBundleIdentifier)"
if [[ $backup_made -eq 1 ]]; then
  printf '旧版本备份：%s\n' "$BACKUP_APP"
else
  printf '旧版本备份：无（此前未安装）\n'
fi
printf '构建候选归档：%s\n' "$ARCHIVE_APP"

if ! open "$TARGET_APP"; then
  printf '应用已安装，但未能自动启动；请从“应用程序”打开 LeetCode Draw。\n' >&2
fi
