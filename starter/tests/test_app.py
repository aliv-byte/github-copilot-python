def test_home_route_returns_200(client):
    response = client.get("/")

    assert response.status_code == 200


def test_new_route_returns_200(client):
    response = client.get("/new")

    assert response.status_code == 200
