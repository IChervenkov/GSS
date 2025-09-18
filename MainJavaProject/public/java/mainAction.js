document.addEventListener('DOMContentLoaded', function () {

    const addCampModal = document.getElementById("addCampModal");
    const addCampModalContent = addCampModal.querySelector('.modal-content');

    const listUsersModal = document.getElementById("listUsersModal");
    const listUsersModalContent = listUsersModal.querySelector('.modal-content');

    const addUsersModal = document.getElementById("addUserModal");
    const addUsersModalContent = addUsersModal.querySelector('.modal-content');

    const editUserModal = document.getElementById("editUserModal");
    const editUserModalContent = editUserModal.querySelector('.modal-content');

    const setPermissionModal = document.getElementById("setPermissionModal");
    const setPermissionModalContent = setPermissionModal.querySelector('.modal-content');

    const modalMess = document.getElementById("myMessage");
    const modalMessContent = modalMess.querySelector('.modal-content-mess');

    const addCampInput = document.getElementById('addCamp');

    const usernameInput = document.getElementById('username');

    const editUsernameInput = document.getElementById('editUsername');
    const editPasswordInput = document.getElementById('editPassword');
    const editConfirmPasswordInput = document.getElementById('editConfirmPassword');
    const editUserId = document.getElementById('userId');

    const loadingIndicator = document.getElementById('loadingIndicator');

    const toastElement = document.getElementById('liveToast');
    const toastMessage = document.getElementById('toast-message');
    const closeToastButton = document.getElementById('close-toast');

    const csrfToken = document.getElementsByName('_csrf')[0].value;

    let globalAction = '';
    let currentPage = 1;
    let checkPermissions = [];
    let allCheckedRow = [];

    const stringPattern = /^[a-zA-Z0-9\s]+$/;
    const searchPattern = /^[a-zA-Z0-9\s!&\)\(._\/:,\-]*$/;
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%&]{8,}$/;

    let currentFetchController = null;

    function startLoading() {
        loadingIndicator.style.display = 'flex';
    }

    function stopLoading() {
        loadingIndicator.style.display = 'none';
    }

    function debounce(func, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const toggleInputValidity = (input, isValid) => {
        input.classList.toggle('is-valid', isValid);
        input.classList.toggle('is-invalid', !isValid);
    };

    const checkForGlobalError = (response, responseBody) => {
        if (response.headers.get('X-Global-Error') === 'true')
            window.location.href = `/error?statusCode=${responseBody.statusCode}&message=${responseBody.message}&details=${responseBody.details}`;
    };

    function firstUpdateTable(rows, currentIndex, rowsPerPage, pageNumberId) {
        for (let i = 0; i < rows.length; i++) {
            rows[i].style.display =
                pageNumberId !== "pageNumberSeventh" && i >= currentIndex && i < currentIndex + rowsPerPage ?
                    "table-row" : i >= currentIndex && i < currentIndex + rowsPerPage ? "block" : "none";
        }

        let totalPages = Math.ceil(rows.length / rowsPerPage) || 1; // Recalculate total pages (avoid division by zero)
        let currentPage = Math.floor(currentIndex / rowsPerPage) + 1;
        document.getElementById(pageNumberId).textContent = `${currentPage}/${totalPages}`;
    }

    function setupTableNavigation(tableId, prevBtnId, nextBtnId, pageNumberId, rowsPerPage = 10, totalPages, page, searchFilters = []) {

        document.getElementById(`${pageNumberId}`).textContent = `${page}/${totalPages}`;

        switch (tableId) {
            case 'permissionsTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        loadPermissionsData(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        loadPermissionsData(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;

            case 'usersTable':
                document.getElementById(`${prevBtnId}`).onclick = () => {
                    if (currentPage > 1) {
                        currentPage--;
                        fetchUsersList(currentPage, rowsPerPage, searchFilters);
                    }
                }

                document.getElementById(`${nextBtnId}`).onclick = () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        fetchUsersList(currentPage, rowsPerPage, searchFilters);
                    }
                };
                break;
        }
    }

    function rewriteTableSearch(className, tableName, headerMap) {

        document.querySelectorAll(`${className}`).forEach((input) => {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
        });

        document.querySelectorAll(`${className}`).forEach((input) => {

            input.addEventListener('input', debounce(() => {

                const filters = document.querySelectorAll(`${className}`);
                const headerCells = document.querySelectorAll(`#${tableName} thead th`);

                const searchFilters = [];

                switch (tableName) {

                    case 'permissionsTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !searchPattern.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        loadPermissionsData(currentPage, 10, searchFilters);
                        break;

                    case 'usersTable':
                        currentPage = 1;
                        filters.forEach((input, columnIndex) => {
                            const searchTerm = input.value.trim().toLowerCase();
                            const headerLabel = headerCells[columnIndex + 1]?.innerText.trim();
                            const columnName = headerMap[headerLabel];

                            if (searchTerm === '' || !searchPattern.test(searchTerm)) return;

                            searchFilters.push({ column: columnName, value: searchTerm });
                        });

                        fetchUsersList(currentPage, 10, searchFilters);
                        break;
                }
            }, 400));
        });
    }

    // Function to show toast with animation
    function showToast(message) {
        toastMessage.textContent = message;

        toastElement.classList.remove('hide');
        toastElement.style.display = 'block';

        setTimeout(() => {
            toastElement.classList.add('show');
        }, 10); // Small delay for transition effect

        // Auto-hide after 6 seconds
        setTimeout(hideToast, 6000);
    }

    // Function to hide toast with animation
    function hideToast() {
        toastElement.classList.remove('show');
        toastElement.classList.add('hide');

        setTimeout(() => {
            toastElement.style.display = 'none';
        }, 500); // Wait for transition to finish
    }

    // Event listener for close button
    closeToastButton.addEventListener('click', hideToast);
    if (document.getElementById('isFirstLogin').value === 'true')
        showToast('By default, the information in the system refers to the first camp created.');

    function showMess(type, message) {

        const icon = document.getElementById('mess-icon');

        switch (type) {
            case 'Error':
                icon.src = "/icon/error.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = false;
                break;

            case 'Warning':
                icon.src = "/icon/timeout.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = false;
                break;

            default:
                icon.src = "/icon/information.png";
                document.getElementById('mess-text').textContent = message;
                isInfo = true;
                break;
        }

        // Add the slide-in effect by adding the necessary classes
        modalMess.classList.add('show');
        modalMessContent.classList.add('show');
        modalMessContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        modalMessContent.classList.remove('slide-out');
    }

    function closeMessModal(action = '') {

        function clearInput(clearModalInput) {
            const inputs = clearModalInput.querySelectorAll('input, textarea, select');
            inputs.forEach(el => {
                if (el.type === 'radio') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
                el.classList.remove('is-valid');
                el.classList.remove('is-invalid');
            });
        }

        async function updateLeftNavigation() {

            startLoading();

            try {

                const res = await fetch('/getCamp', {
                    method: 'GET',
                    headers: {
                        'X-Is-Fetch': 'true'
                    }
                });

                if (!res.ok) {
                    const error = await res.json();
                    checkForGlobalError(res, error);
                    showMess('Error', 'Failed to fetch data');
                    return;
                }

                const { navCamp, permissions } = await res.json();
                const leftNav = document.querySelector('.left-nav');
                const campId = document.getElementById('campId');
                leftNav.innerHTML = '';

                // Build Add Camp Button
                const titleContainer = document.createElement('div');
                titleContainer.className = 'title-container mb-2 sticky-top w-100 bg-light';

                const isAllowed = permissions && !(permissions.some(p => p.permission_name === 'Full permission' || p.permission_name === 'Add camp'));

                titleContainer.innerHTML = `
                    <div class="btn-container" style="width: 100%;">
                        <button id="addCampButton"
                            class="sticky-button ${isAllowed ? '' : 'disabled-button'}"
                            ${!isAllowed ? 'disabled' : ''}>
                            <i class="bi bi-plus-circle"></i> Add camp
                        </button>
                        <div class="tooltip-custom">
                            <i class="bi bi-question-circle"></i>
                            <span class="tooltiptext">Add camp to the system</span>
                        </div>
                    </div>
                `;

                leftNav.appendChild(titleContainer);

                // Create the camp list
                const ul = document.createElement('ul');

                navCamp.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';

                    const button = document.createElement('button');
                    const pinCamp = campId.value === item.id ? 'pinClass' : '';
                    button.className = `flex-grow-1 text-decoration-none full-back ${pinCamp}`;
                    button.id = item.id;
                    button.innerHTML = item.name;

                    button.addEventListener('click', async (event) => {
                        const campId = event.target.id;
                        const campName = event.target.textContent;

                        document.querySelectorAll('.left-nav ul li button').forEach(btn => btn.classList.remove('pinClass'));
                        event.target.classList.add('pinClass');

                        startLoading();

                        try {
                            const response = await fetch('/setCampValue', {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'CSRF-Token': csrfToken
                                },
                                body: JSON.stringify({ campId: campId })
                            });

                            const data = await response.json();

                            if (!response.ok) {
                                checkForGlobalError(response, data);
                                showMess('Error', data.message || 'Something went wrong');
                                return;
                            }

                            showToast(`Camp selected: ${campName}. The system will display information only for this camp.`);

                        } catch (error) {
                            showMess('Error', 'Network error or server is unavailable.');
                        } finally {
                            stopLoading();
                        }
                    });

                    li.appendChild(button);
                    ul.appendChild(li);
                });

                leftNav.appendChild(ul);

            } catch (err) {
                showMess('Error', `Error fetching navigation data`);
            } finally {
                stopLoading();
            }
        }

        // Add the slide-out effect
        modalMessContent.classList.add('slide-out');
        modalMessContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {
            modalMess.classList.remove('show');
            modalMessContent.classList.remove('show');

            if (isInfo)
                switch (action) {
                    case 'addCamp':
                        clearInput(addCampModalContent);
                        updateLeftNavigation();
                        break;

                    case 'setPermissions':
                        checkPermissions = [];
                        clearInput(setPermissionModalContent);
                        loadPermissionsData();
                        break;

                    case 'addUser':
                        clearInput(setPermissionModalContent);
                        clearInput(listUsersModalContent);
                        clearInput(addUsersModalContent);
                        loadPermissionsHeaders();
                        loadPermissionsData();
                        fetchUsersList();
                        break;

                    case 'editUser':
                        clearInput(setPermissionModalContent);
                        clearInput(listUsersModalContent);
                        closeEditUserModal();
                        loadPermissionsHeaders();
                        loadPermissionsData();
                        fetchUsersList();
                        break;

                    case 'deleteUser':
                        allCheckedRow = [];
                        clearInput(setPermissionModalContent);
                        clearInput(listUsersModalContent);
                        loadPermissionsHeaders();
                        loadPermissionsData();
                        fetchUsersList();
                        break;
                }

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddCampModal() {

        // Add the slide-in effect by adding the necessary classes
        addCampModal.classList.add('show');
        addCampModalContent.classList.add('show');
        addCampModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addCampModalContent.classList.remove('slide-out');
    }

    function closeAddCampModal() {
        // Add the slide-out effect
        addCampModalContent.classList.add('slide-out');
        addCampModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            addCampInput.classList.remove('is-invalid');
            addCampInput.classList.remove('is-valid');
            addCampInput.value = '';

            addCampModal.classList.remove('show');
            addCampModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openListUsersModal() {

        // Add the slide-in effect by adding the necessary classes
        listUsersModal.classList.add('show');
        listUsersModalContent.classList.add('show');
        listUsersModalContent.classList.add('slide-in');

        currentPage = 1;

        const headerDate = {
            'Username': 'username'
        };

        rewriteTableSearch('.search-input-user', 'usersTable', headerDate);

        fetchUsersList();

        // Ensure that any 'slide-out' class is removed if it was previously added
        listUsersModalContent.classList.remove('slide-out');
    }

    function closeListUsersModal() {
        // Add the slide-out effect
        listUsersModalContent.classList.add('slide-out');
        listUsersModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-user').forEach((input) => {
                input.value = '';
            });

            allCheckedRow = [];

            listUsersModal.classList.remove('show');
            listUsersModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openAddUsersModal() {

        // Add the slide-in effect by adding the necessary classes
        addUsersModal.classList.add('show');
        addUsersModalContent.classList.add('show');
        addUsersModalContent.classList.add('slide-in');

        // Ensure that any 'slide-out' class is removed if it was previously added
        addUsersModalContent.classList.remove('slide-out');
    }

    function closeAddUsersModal() {
        // Add the slide-out effect
        addUsersModalContent.classList.add('slide-out');
        addUsersModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#form3 input').forEach((input) => {
                input.classList.remove('is-invalid');
                input.classList.remove('is-valid');
                input.value = '';
            });

            addUsersModal.classList.remove('show');
            addUsersModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openEditUserModal(userId, username) {

        // Add the slide-in effect by adding the necessary classes
        editUserModal.classList.add('show');
        editUserModalContent.classList.add('show');
        editUserModalContent.classList.add('slide-in');

        editUserId.value = userId;
        editUsernameInput.value = username;

        // Ensure that any 'slide-out' class is removed if it was previously added
        editUserModalContent.classList.remove('slide-out');
    }

    function closeEditUserModal() {
        // Add the slide-out effect
        editUserModalContent.classList.add('slide-out');
        editUserModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('#form4 input').forEach((input) => {
                input.classList.remove('is-invalid');
                input.classList.remove('is-valid');
                input.value = '';
            });

            editUserModal.classList.remove('show');
            editUserModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    function openSetPermissionModal() {

        // Add the slide-in effect by adding the necessary classes
        setPermissionModal.classList.add('show');
        setPermissionModalContent.classList.add('show');
        setPermissionModalContent.classList.add('slide-in');

        currentPage = 1;

        loadPermissionsHeaders();
        loadPermissionsData();

        // Ensure that any 'slide-out' class is removed if it was previously added
        setPermissionModalContent.classList.remove('slide-out');
    }

    function closeSetPermissionModal() {
        // Add the slide-out effect
        setPermissionModalContent.classList.add('slide-out');
        setPermissionModalContent.classList.remove('slide-in');

        // Delay hiding the modal to allow the animation to finish
        setTimeout(function () {

            document.querySelectorAll('.search-input-permission').forEach((input) => {
                input.value = '';
            });

            checkPermissions = [];

            setPermissionModal.classList.remove('show');
            setPermissionModalContent.classList.remove('show');

        }, 400); // Match the duration of the animation (0.4s)
    }

    document.getElementById('addCampButton').onclick = openAddCampModal;
    document.getElementById('setPermissionButton').onclick = openSetPermissionModal;
    document.getElementById('userList').onclick = openListUsersModal;
    document.getElementById('addUserButton').onclick = openAddUsersModal;

    document.getElementById('deleteUser').addEventListener('click', async () => {

        const submitButton = document.createElement('button');
        var isRemove = false;
        let hasError = false;
        var result = {};

        if (allCheckedRow.length === 0) {
            showMess('Error', 'You have not selected any users to remove');
            return;
        }

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');
        submitButton.addEventListener('click', async () => {

            isRemove = true;
            hasError = false;

            startLoading();

            try {

                for (const data of allCheckedRow) {
                    const deleteResponse = await fetch('/deleteUser', {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'CSRF-Token': csrfToken
                        },
                        body: JSON.stringify(data)
                    });

                    if (!deleteResponse.ok) {
                        hasError = true;
                        result = await deleteResponse.json();
                        checkForGlobalError(deleteResponse, result);
                        break;
                    }
                }

            } catch (error) {
                hasError = true;
                result = { message: 'An error occurred while processing the request.' };
            } finally {
                stopLoading();
            }

            closeMessModal();
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show the info modal
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isRemove) {
                closeWarningObserver.disconnect();
                if (isRemove && !hasError) {
                    globalAction = 'deleteUser';
                    showMess('Info', 'The selected users have been removed');
                } else if (hasError) {
                    showMess('Error', result.message);
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        showMess('Warning', 'Are you sure you want to remove the selected users?');
    });

    document.querySelectorAll('.left-nav ul li button').forEach(button => {
        button.addEventListener('click', async (event) => {
            const campId = event.target.id;
            const campName = event.target.textContent;

            document.querySelectorAll('.left-nav ul li button').forEach(btn => btn.classList.remove('pinClass'));
            event.target.classList.add('pinClass');

            startLoading();

            try {
                const response = await fetch('/setCampValue', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ campId: campId })
                });

                const data = await response.json(); // Parse JSON response

                if (!response.ok) {
                    checkForGlobalError(response, data);
                    showMess('Error', data.message || 'Something went wrong');
                    return;
                }

                showToast(`Camp selected: ${campName}. The system will display information only for this camp.`);

            } catch (error) {
                showMess('Error', 'Network error or server is unavailable.');
            } finally {
                stopLoading();
            }
        });
    });

    async function loadPermissionsHeaders() {

        startLoading();

        try {

            const response = await fetch(`/permissions/data`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', 'Failed to fetch permissions data');
                return;
            }

            const data = await response.json();

            const { users } = data;

            const table = document.getElementById('permissionsTable');

            // --- Header ---
            let thead = table.querySelector('thead');
            thead.innerHTML = '';

            const headerRow = document.createElement('tr');
            let thPerm = document.createElement('th');

            const inputSearch = document.createElement('input');
            inputSearch.type = 'text';
            inputSearch.className = 'search-input-permission';
            inputSearch.placeholder = 'Search...';

            thPerm.appendChild(inputSearch);
            thPerm.appendChild(document.createTextNode('Permission'));

            headerRow.appendChild(thPerm);

            users.forEach(user => {

                if (user.username === 'admin' || user.username === 'PhoneUser')
                    return;

                let th = document.createElement('th');
                th.style = "cursor: not-allowed"

                const inputSearch = document.createElement('input');
                inputSearch.type = 'text';
                inputSearch.className = 'disabled-button search-input-permission';
                inputSearch.placeholder = 'Search...';

                th.appendChild(inputSearch);
                th.appendChild(document.createTextNode(user.username));

                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);

            const headerDate = {
                'Permission': 'permission_name'
            };

            rewriteTableSearch('.search-input-permission', 'permissionsTable', headerDate);

        } catch (error) {
            showMess('Error', 'Failed to load permissions. Please connect to the support.');
        } finally {
            stopLoading();
        }
    }

    async function loadPermissionsData(page = 1, limit = 10, searchFilters = []) {

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {

            const searchParams = new URLSearchParams({
                page,
                limit
            });

            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/permissions/data?${searchParams.toString()}`, {
                method: 'GET',
                headers: {
                    'X-Is-Fetch': 'true'
                },
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', 'Failed to fetch permissions data');
                return;
            }

            const data = await response.json();

            const { users, permissions, user_permissions, totalPages } = data;

            const table = document.getElementById('permissionsTable');

            // --- Body ---
            let tbody = table.querySelector('tbody');
            tbody.innerHTML = '';

            permissions.forEach(perm => {
                const row = document.createElement('tr');

                let tdPerm = document.createElement('td');
                tdPerm.textContent = perm.permission_name;
                row.appendChild(tdPerm);

                users.forEach(user => {

                    if (user.username === 'admin' || user.username === 'PhoneUser')
                        return;

                    let td = document.createElement('td');
                    let input = document.createElement('input');
                    input.type = 'checkbox';
                    input.name = `permissions[${user.id}][]`;
                    input.value = perm.id;

                    if (user_permissions.some(up => up.user_id === user.id && up.perm_id === perm.id)
                        || checkPermissions.some(cp => cp.userId === user.id && cp.permId === perm.id && cp.isCheck)) {
                        input.checked = true;
                    }

                    input.addEventListener('change', () => {
                        const entry = {
                            userId: user.id,
                            permId: perm.id,
                            isCheck: input.checked
                        };

                        // Remove any existing entry for this user+perm
                        checkPermissions = checkPermissions.filter(
                            item => !(item.userId === user.id && item.permId === perm.id)
                        );

                        // Add updated entry
                        checkPermissions.push(entry);
                    });

                    td.classList.add("text-wrap");
                    td.style = "max-width: 200px;";

                    td.appendChild(input);
                    row.appendChild(td);
                });

                tbody.appendChild(row);
            });

            const rowsTable = tbody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumber');

            setupTableNavigation("permissionsTable", "prevBtn", "nextBtn", "pageNumber", limit, totalPages, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'Failed to load permissions. Please connect to the support.');
        } finally {
            stopLoading();
        }
    }

    async function fetchUsersList(page = 1, limit = 10, searchFilters = []) {
        const tbody = document.getElementById('tableUserBody');
        const userTableBody = document.getElementById('usersTable').getElementsByTagName('tbody')[0];
        tbody.innerHTML = '';

        if (currentFetchController) {
            currentFetchController.abort();
        }

        currentFetchController = new AbortController();
        const { signal } = currentFetchController;

        startLoading();

        try {
            const searchParams = new URLSearchParams({ page, limit });
            searchFilters.forEach(filter => {
                searchParams.append('searchColumn', filter.column);
                searchParams.append('searchValue', filter.value);
            });

            const response = await fetch(`/getUsers?${searchParams.toString()}`, {
                method: 'GET',
                headers: { 'X-Is-Fetch': 'true' },
                signal
            });

            if (!response.ok) {
                const error = await response.json();
                checkForGlobalError(response, error);
                showMess('Error', error.message);
                return;
            }

            let { usersListData, totalUsersListData } = await response.json();
            usersListData = Array.from(new Map(usersListData.map(s => [s.username.toLowerCase(), s])).values());

            // Clear previous header checkbox
            const thead = tbody.parentElement.querySelector('thead');
            const headerRow = thead.querySelector('tr');
            headerRow.querySelectorAll('th').forEach(th => {
                if (!th.textContent.trim()) th.remove();
            });

            // Add header checkbox
            const headerCheckbox = document.createElement('input');
            headerCheckbox.type = 'checkbox';
            headerCheckbox.className = 'form-check-input header-checkbox';
            headerCheckbox.style.border = '1px solid black';

            headerCheckbox.addEventListener('change', (event) => {
                headerCheckbox.style.backgroundColor = event.target.checked ? 'green' : '';
                const isChecked = event.target.checked;

                // Get all visible rows
                const visibleRows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.style.display !== 'none');

                visibleRows.forEach(row => {
                    const checkbox = row.querySelector('.form-check-input');
                    if (checkbox) {
                        checkbox.checked = isChecked;
                        checkbox.style.backgroundColor = isChecked ? 'green' : '';
                        if (isChecked) {
                            allCheckedRow.push({ code: checkbox.dataset.id });
                        } else {
                            allCheckedRow = allCheckedRow.filter(item => item.code !== checkbox.dataset.id);
                        }
                    }
                });

                // Ensure no duplicates in allCheckedRow
                if (isChecked) {
                    allCheckedRow = Array.from(new Set(allCheckedRow.map(item => item.code)))
                        .map(code => ({ code }));
                }
            });

            const headerCell = document.createElement('th');

            headerCell.appendChild(headerCheckbox);
            headerRow.insertBefore(headerCell, headerRow.firstChild);

            // Fill rows
            usersListData.forEach(item => {
                const row = document.createElement("tr");
                row.classList.add('data-soldier');

                // Checkbox cell
                const checkboxCell = document.createElement('td');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'form-check-input';
                checkbox.dataset.id = item.id;
                checkbox.style.border = '1px solid black';

                if (allCheckedRow.some(i => i.code === item.id)) {
                    checkbox.checked = true;
                }

                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        allCheckedRow.push({ code: item.id });
                    } else {
                        checkbox.style.backgroundColor = '';
                        allCheckedRow = allCheckedRow.filter(row => row.code !== item.id);
                    }
                });

                checkboxCell.appendChild(checkbox);
                row.appendChild(checkboxCell);

                // Username cell
                const usernameCell = document.createElement("td");
                usernameCell.textContent = item.username;
                usernameCell.classList.add("text-wrap");
                usernameCell.style = "max-width: 200px;";
                row.appendChild(usernameCell);

                const actionCell = document.createElement("td");
                const approveBtn = document.createElement("button");
                const denyBtn = document.createElement("button");

                // Approve/Deny buttons if status = pending
                if (item.status === 'pending') {

                    approveBtn.textContent = "Approve";
                    approveBtn.className = "btn btn-success btn-sm me-1";
                    approveBtn.addEventListener("click", async () => {
                        await verifyUserRequest(item.id, "approved");
                        fetchUsersList(page, limit, searchFilters);
                    });

                    denyBtn.textContent = "Deny";
                    denyBtn.className = "btn btn-danger btn-sm";
                    denyBtn.addEventListener("click", async () => {
                        await verifyUserRequest(item.id, "denied");
                        fetchUsersList(page, limit, searchFilters);
                    });

                    actionCell.appendChild(approveBtn);
                    actionCell.appendChild(denyBtn);
                }

                row.appendChild(actionCell);

                // Click event (only if not action cell)
                row.addEventListener('click', (event) => {
                    if (event.target.closest('td') && event.target.closest('td').cellIndex !== 0) {
                        if (!event.target.closest('button')) {
                            openEditUserModal(item.id, item.username);
                        }
                    }
                });

                tbody.appendChild(row);
            });

            const rowsTable = userTableBody.getElementsByTagName("tr");
            firstUpdateTable(rowsTable, 0, 10, 'pageNumberSecond');
            setupTableNavigation("usersTable", "prevBtnSecond", "nextBtnSecond", "pageNumberSecond", limit, totalUsersListData, page, searchFilters);

        } catch (error) {
            if (error.name === 'AbortError') return;
            showMess('Error', 'An error occurred while fetching users data. Please try again later.');
        } finally {
            stopLoading();
        }
    }

    // helper to call /admin/verify
    async function verifyUserRequest(userId, decision) {

        startLoading();
                        
        try {
            const response = await fetch('/admin/verify', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ id: userId, decision })
            });

            if (!response.ok) {
                const error = await response.json();
                showMess('Error', error.errorMessage || 'Verification failed');
                return;
            }

            showMess('Success', `User request ${decision}`);

        } catch (err) {
            showMess('Error', 'Network error while verifying request');
        } finally {
            stopLoading();
        }
    }


    document.getElementById('form1').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form2').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form3').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form4').addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    });

    document.getElementById('form1').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: addCampInput, condition: !stringPattern.test(addCampInput.value) }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        const data = {
            campName: addCampInput.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'addCamp';
                    showMess('Info', 'Camp added successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the camp');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warning', 'Are you sure you want to add this camp?');
    };

    document.getElementById('form2').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const data = {
            permissions: checkPermissions
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'setPermissions';
                    showMess('Info', 'Permissions are set successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the camp');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warning', 'Are you sure you want to set this permissions to the users?');
    };

    document.getElementById('form3').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: usernameInput, condition: !stringPattern.test(usernameInput.value) }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        const data = {
            username: usernameInput.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'addUser';
                    showMess('Info', responseData.message);
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while adding the user');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warning', 'Are you sure you want to add this user?');
    };

    document.getElementById('form4').onsubmit = async function (event) {

        event.preventDefault(); // Prevent default form submission

        const inputsToCheck = [
            { input: editUsernameInput, condition: !stringPattern.test(editUsernameInput.value) },
            { input: editPasswordInput, condition: !passwordPattern.test(editPasswordInput.value) },
            { input: editConfirmPasswordInput, condition: editConfirmPasswordInput.value !== editPasswordInput.value }
        ];

        let isValid = true;

        inputsToCheck.forEach(({ input, condition }) => {
            if (condition) {
                toggleInputValidity(input, false);
                isValid = false;
            } else {
                toggleInputValidity(input, true);
            }
        });

        if (!isValid) {
            return;
        }

        const data = {
            id: editUserId.value,
            username: editUsernameInput.value,
            password: editPasswordInput.value
        };

        const submitButton = document.createElement('button');
        var isSubmit = false;
        let hasError = false;
        var responseData = {};

        submitButton.textContent = 'Yes';
        submitButton.classList.add('btn', 'btn-success');

        submitButton.addEventListener('click', async () => {
            hasError = false;
            isSubmit = true;

            startLoading();

            try {
                const response = await fetch(this.action, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    },
                    body: JSON.stringify(data)
                });

                responseData = await response.json();

                if (!response.ok) {
                    checkForGlobalError(response, responseData);
                    hasError = true;
                }

                closeMessModal();

            } catch (error) {
                hasError = true;
            } finally {
                stopLoading();
            }
        });

        modalMessContent.appendChild(submitButton);

        // Wait for the modal to close, then check if the submit button was clicked
        const observer = new MutationObserver(() => {
            if (!modalMess.classList.contains('show') && isSubmit) {
                observer.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }
            }
        });

        observer.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Close the warning modal and show appropriate messages based on the result
        const closeWarningObserver = new MutationObserver(() => {
            if (!modalMess.classList.contains('show')) {
                closeWarningObserver.disconnect();

                if (modalMessContent.contains(submitButton)) {
                    // Check if the button is still a child before removing
                    modalMessContent.removeChild(submitButton);
                }

                if (isSubmit && !hasError) {
                    globalAction = 'editUser';
                    showMess('Info', 'User edit successfully');
                } else if (isSubmit) {
                    showMess('Error', responseData.message || 'An error occurred while editing the user');
                }
            }
        });

        closeWarningObserver.observe(modalMess, { attributes: true, attributeFilter: ['class'] });

        // Show the warning modal
        showMess('Warning', 'Are you sure you want to edit this user?');
    };

    addCampInput.addEventListener('input', () => {
        toggleInputValidity(addCampInput, stringPattern.test(addCampInput.value));
    });

    usernameInput.addEventListener('input', () => {
        toggleInputValidity(usernameInput, stringPattern.test(usernameInput.value));
    });

    editUsernameInput.addEventListener('input', () => {
        toggleInputValidity(editUsernameInput, stringPattern.test(editUsernameInput.value));
    });

    editPasswordInput.addEventListener('input', () => {
        toggleInputValidity(editPasswordInput, passwordPattern.test(editPasswordInput.value));
    });
    editConfirmPasswordInput.addEventListener('input', () => {
        toggleInputValidity(editConfirmPasswordInput, editConfirmPasswordInput.value === editPasswordInput.value);
    });

    document.getElementsByClassName('close-btn')[0].onclick = closeAddCampModal;
    document.getElementsByClassName('close-btn')[1].onclick = closeSetPermissionModal;
    document.getElementsByClassName('close-btn')[2].onclick = closeListUsersModal;
    document.getElementsByClassName('close-btn')[3].onclick = closeAddUsersModal;
    document.getElementsByClassName('close-btn')[4].onclick = closeEditUserModal;
    document.getElementsByClassName('close-btn')[5].onclick = function () {
        closeMessModal(globalAction);
    };

    window.addEventListener("click", function (event) {
        switch (event.target) {

            case addCampModal:
                closeAddCampModal();
                break;

            case setPermissionModal:
                closeSetPermissionModal();
                break;

            case listUsersModal:
                closeListUsersModal();
                break;

            case addUsersModal:
                closeAddUsersModal();
                break;

            case editUserModal:
                closeEditUserModal();
                break;

            case modalMess:
                closeMessModal(globalAction);
                break;
        }
    });

});